import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, QueryFailedError, Repository } from "typeorm";
import { Role } from "@/common/enums/role.enum";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { Order } from "@/modules/orders/entities/order.entity";
import { OrderStatus, PaymentStatus } from "@/modules/orders/order-status";
import { requirePayableAmount } from "./payable-amount";

import { lockHarvestListing } from "@/modules/listings/lock-harvest-listing";
import { Payment } from "./entities/payment.entity";
import {
  PaymentAttempt,
  PaymentMethod,
  ReceiptDecision,
} from "./entities/payment-attempt.entity";
import { QueryPaymentsDto, SubmitPaymentDto } from "./payment.dto";

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  private scope(manager: EntityManager, actor: AuthUser) {
    const query = manager
      .getRepository(Order)
      .createQueryBuilder("procurement")
      .innerJoin("procurement.orderRequest", "request")
      .innerJoin("request.harvestListing", "listing")
      .innerJoin("listing.farmerProfile", "farmer")
      .innerJoin("request.priceOffer", "offer")
      .innerJoin("offer.factoryProfile", "factory");
    if (actor.role !== Role.ADMIN) {
      const profile = actor.role === Role.GROWER ? "farmer" : "factory";
      query.andWhere(`${profile}.userId = :userId`, { userId: actor.id });
    }
    return query;
  }

  private async requireOrder(
    manager: EntityManager,
    actor: AuthUser,
    id: number,
  ) {
    if (id < 1 || id > 2147483647)
      throw new NotFoundException("Order not found");
    const order = await this.scope(manager, actor)
      .andWhere("procurement.id = :id", { id })
      .getOne();
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async amount(actor: AuthUser, id: number) {
    const order = await this.requireOrder(this.orders.manager, actor, id);
    if (
      order.orderStatus !== OrderStatus.COLLECTED &&
      order.orderStatus !== OrderStatus.COMPLETED
    ) {
      throw new ConflictException("Order has not been collected");
    }
    const amountBdt = await requirePayableAmount(this.orders.manager, id);
    return {
      orderId: id,
      amountBdt,
      currency: "BDT",
      paymentStatus: order.paymentStatus,
    };
  }
  async submit(
    actor: AuthUser,
    id: number,
    key: string | undefined,
    dto: SubmitPaymentDto,
  ) {
    if (!key || !/^[!-~]{1,128}$/.test(key))
      throw new BadRequestException("A valid Idempotency-Key is required");
    const { method, paymentDate } = dto;
    const provider = dto.provider ?? null;
    const reference = dto.reference ?? null;
    if (
      (method === PaymentMethod.CASH && provider !== null) ||
      (method === PaymentMethod.MOBILE_FINANCIAL_SERVICE &&
        provider !== "BKASH" &&
        provider !== "NAGAD")
    ) {
      throw new BadRequestException(
        "Provider does not match the payment method",
      );
    }
    try {
      return await this.withOrderLock(actor, id, async (manager, order) => {
        let payment = await manager.findOneBy(Payment, { orderId: id });
        if (payment) {
          const original = await manager.findOneBy(PaymentAttempt, {
            paymentId: payment.id,
            idempotencyKey: key,
          });
          if (original) {
            if (
              original.method !== method ||
              original.provider !== provider ||
              original.reference !== reference ||
              original.paymentDate !== paymentDate
            ) {
              throw new ConflictException(
                "Idempotency-Key was already used for another payload",
              );
            }
            return this.submissionResponse(payment, original);
          }
        }
        if (
          order.orderStatus !== OrderStatus.COLLECTED ||
          ![PaymentStatus.PENDING, PaymentStatus.REJECTED].includes(
            order.paymentStatus,
          )
        ) {
          throw new ConflictException(
            "Order cannot accept a payment submission",
          );
        }
        const amountBdt = await requirePayableAmount(manager, id);
        payment ??= await manager.save(Payment, { orderId: id, amountBdt });
        const attempt = await manager.save(PaymentAttempt, {
          paymentId: payment.id,
          submittedBy: actor.id,
          idempotencyKey: key,
          method,
          provider,
          reference,
          paymentDate,
        });
        await manager.update(Order, id, {
          paymentStatus: PaymentStatus.SUBMITTED,
        });
        return this.submissionResponse(payment, attempt);
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { constraint?: string }).constraint ===
          "UQ_payment_attempt_reference"
      ) {
        throw new ConflictException(
          "Payment transaction reference was already used",
        );
      }
      throw error;
    }
  }

  async decide(
    actor: AuthUser,
    id: number,
    attemptId: number,
    decision: ReceiptDecision,
    rejectionReason: string | null,
  ) {
    if (attemptId < 1 || attemptId > 2147483647)
      throw new NotFoundException("Payment attempt not found");
    return this.withOrderLock(actor, id, async (manager, order) => {
      const payment = await manager.findOneBy(Payment, { orderId: id });
      const attempt =
        payment &&
        (await manager.findOneBy(PaymentAttempt, {
          id: attemptId,
          paymentId: payment.id,
        }));
      if (!payment || !attempt)
        throw new NotFoundException("Payment attempt not found");
      if (
        attempt.decision === ReceiptDecision.CONFIRMED &&
        decision === ReceiptDecision.CONFIRMED
      ) {
        return this.attemptResponse(attempt);
      }
      if (
        attempt.decision ||
        order.orderStatus !== OrderStatus.COLLECTED ||
        order.paymentStatus !== PaymentStatus.SUBMITTED
      ) {
        throw new ConflictException("Payment attempt cannot be decided");
      }
      const changes = {
        decision,
        decidedBy: actor.id,
        decidedAt: new Date(),
        rejectionReason,
      };
      await manager.update(PaymentAttempt, attemptId, changes);
      await manager.update(Order, id, {
        paymentStatus:
          decision === ReceiptDecision.CONFIRMED
            ? PaymentStatus.CONFIRMED
            : PaymentStatus.REJECTED,
      });
      return this.attemptResponse({ ...attempt, ...changes });
    });
  }

  async details(actor: AuthUser, id: number) {
    const order = await this.requireOrder(this.orders.manager, actor, id);
    const payment = await this.orders.manager.findOneBy(Payment, {
      orderId: id,
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return this.paymentResponse(payment, order.paymentStatus);
  }

  async history(
    actor: AuthUser,
    id: number,
    { page, limit }: QueryPaymentsDto,
  ) {
    await this.requireOrder(this.orders.manager, actor, id);
    const payment = await this.orders.manager.findOneBy(Payment, {
      orderId: id,
    });
    if (!payment) throw new NotFoundException("Payment not found");
    const [rows, total] = await this.orders.manager.findAndCount(
      PaymentAttempt,
      {
        where: { paymentId: payment.id },
        order: { id: "DESC" },
        skip: (page - 1) * limit,
        take: limit,
      },
    );
    return {
      data: rows.map((attempt) => this.attemptResponse(attempt)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async list(actor: AuthUser, { page, limit }: QueryPaymentsDto) {
    const query = this.orders.manager
      .getRepository(Payment)
      .createQueryBuilder("payment")
      .innerJoinAndSelect("payment.order", "procurement")
      .where(
        "payment.orderId IN (" +
          this.scope(this.orders.manager, actor)
            .select("procurement.id")
            .getQuery() +
          ")",
      );
    const [rows, total] = await query
      .setParameters({ userId: actor.id })
      .orderBy("payment.id", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      data: rows.map((payment) =>
        this.paymentResponse(payment, payment.order!.paymentStatus),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private withOrderLock<T>(
    actor: AuthUser,
    id: number,
    work: (manager: EntityManager, order: Order) => Promise<T>,
  ) {
    return this.orders.manager.transaction(async (manager) => {
      const reference = await this.requireOrder(manager, actor, id);
      await lockHarvestListing(manager, reference.harvestListingId);
      await manager.findOneOrFail(Order, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });
      return work(manager, await this.requireOrder(manager, actor, id));
    });
  }

  private paymentResponse(payment: Payment, paymentStatus: PaymentStatus) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amountBdt: payment.amountBdt,
      currency: "BDT",
      paymentStatus,
      createdAt: payment.createdAt,
    };
  }

  private attemptResponse(attempt: PaymentAttempt) {
    const {
      id,
      method,
      provider,
      reference,
      paymentDate,
      createdAt,
      submittedBy,
      decision,
      decidedBy,
      decidedAt,
      rejectionReason,
    } = attempt;
    return {
      id,
      method,
      provider,
      reference,
      paymentDate,
      createdAt,
      submittedBy,
      decision,
      decidedBy,
      decidedAt,
      rejectionReason,
    };
  }

  private submissionResponse(payment: Payment, attempt: PaymentAttempt) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amountBdt: payment.amountBdt,
      currency: "BDT",
      attempt: this.attemptResponse({
        ...attempt,
        decision: null,
        decidedBy: null,
        decidedAt: null,
        rejectionReason: null,
      }),
    };
  }
}
