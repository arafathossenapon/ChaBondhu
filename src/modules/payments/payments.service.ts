import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { Role } from "@/common/enums/role.enum";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { Order } from "@/modules/orders/entities/order.entity";
import { OrderStatus } from "@/modules/orders/order-status";
import { requirePayableAmount } from "./payable-amount";

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
}
