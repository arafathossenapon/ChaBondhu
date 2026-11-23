import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository, SelectQueryBuilder } from "typeorm";
import { ListingStatus } from "@/common/enums/listing-status.enum";
import { Role } from "@/common/enums/role.enum";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { HarvestListing } from "@/modules/listings/entities/harvest-listing.entity";
import { lockHarvestListing } from "@/modules/listings/lock-harvest-listing";
import { QueryOrdersDto } from "./dto/query-orders.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { Order } from "./entities/order.entity";
import { requirePayableAmount } from "@/modules/payments/payable-amount";
import { OrderStatus, PaymentStatus } from "./order-status";

const transitions = {
  [OrderStatus.CANCELLED]: { role: Role.GROWER, from: OrderStatus.ACCEPTED },
  [OrderStatus.PICKUP_SCHEDULED]: {
    role: Role.FACTORY,
    from: OrderStatus.ACCEPTED,
  },
  [OrderStatus.COMPLETED]: { role: Role.FACTORY, from: OrderStatus.COLLECTED },
  [OrderStatus.COLLECTED]: {
    role: Role.FACTORY,
    from: OrderStatus.PICKUP_SCHEDULED,
  },
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  async listOwn(
    actor: AuthUser,
    { page, limit, orderStatus, paymentStatus }: QueryOrdersDto,
  ) {
    const query = this.orderQuery(this.orders.manager);
    this.scopeToParticipant(query, actor);
    if (orderStatus !== undefined)
      query.andWhere("procurement.orderStatus = :orderStatus", { orderStatus });
    if (paymentStatus !== undefined)
      query.andWhere("procurement.paymentStatus = :paymentStatus", {
        paymentStatus,
      });
    const [rows, total] = await query
      .orderBy("procurement.createdAt", "DESC")
      .addOrderBy("procurement.id", "DESC")
      .offset((page - 1) * limit)
      .limit(limit)
      .getManyAndCount();
    return {
      data: rows.map(this.toResponse),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(actor: AuthUser, id: number) {
    this.requireOrderId(id);
    const query = this.orderQuery(this.orders.manager).where(
      "procurement.id = :id",
      { id },
    );
    if (actor.role !== Role.ADMIN) this.scopeToParticipant(query, actor);
    const order = await query.getOne();
    if (!order) throw new NotFoundException("Order not found");
    return this.toResponse(order);
  }

  async updateStatus(actor: AuthUser, id: number, dto: UpdateOrderStatusDto) {
    this.requireOrderId(id);
    const {
      orderStatus,
      proposedCollectionDate,
      collectionPoint,
      pickupNotes,
      estimatedTransportCostBdt,
      actualCollectedWeightKg,
    } = dto;
    const transition = transitions[orderStatus];
    if (actor.role !== transition.role)
      throw new ForbiddenException(
        "This role cannot make that order transition",
      );
    const pickupFields = [
      proposedCollectionDate,
      collectionPoint,
      pickupNotes,
      estimatedTransportCostBdt,
    ];
    if (
      (orderStatus !== OrderStatus.PICKUP_SCHEDULED &&
        pickupFields.some((value) => value !== undefined)) ||
      (orderStatus !== OrderStatus.COLLECTED &&
        actualCollectedWeightKg !== undefined)
    ) {
      throw new BadRequestException(
        "Fields do not belong to the requested order transition",
      );
    }
    return this.orders.manager.transaction(async (manager) => {
      const reference = await manager.findOne(Order, {
        where: { id },
        select: { harvestListingId: true },
      });
      if (!reference) throw new NotFoundException("Order not found");
      const listing = await lockHarvestListing(
        manager,
        reference.harvestListingId,
      );
      const query = this.orderQuery(manager).where("procurement.id = :id", {
        id,
      });
      this.scopeToParticipant(query, actor);
      const order = await query.getOne();
      if (!order) throw new NotFoundException("Order not found");
      if (
        order.orderStatus !== transition.from ||
        listing.status !== ListingStatus.RESERVED
      ) {
        throw new ConflictException(
          "Order cannot move to the requested status",
        );
      }
      if (orderStatus === OrderStatus.COMPLETED) {
        if (order.paymentStatus !== PaymentStatus.CONFIRMED) {
          throw new ConflictException(
            "Grower payment confirmation is required",
          );
        }
        await requirePayableAmount(manager, id);
      }
      await manager.update(Order, id, {
        orderStatus,
        proposedCollectionDate,
        collectionPoint,
        pickupNotes,
        estimatedTransportCostBdt,
        actualCollectedWeightKg,
      });
      if (orderStatus === OrderStatus.CANCELLED) {
        // মডারেশনে সরানো তালিকা আবার বাজারে ফেরে না।
        await manager.update(HarvestListing, listing.id, {
          status: listing.isActive
            ? ListingStatus.ACTIVE
            : ListingStatus.CANCELLED,
        });
      }
      if (orderStatus === OrderStatus.COMPLETED) {
        // অর্ডার সম্পন্ন হলে একই ট্রানজ্যাকশনে তালিকাটি বিক্রি হয়েছে বলে চিহ্নিত করি।
        await manager.update(HarvestListing, listing.id, {
          status: ListingStatus.SOLD,
        });
      }
      return this.toResponse(await query.getOneOrFail());
    });
  }

  private orderQuery(manager: EntityManager) {
    return manager
      .getRepository(Order)
      .createQueryBuilder("procurement")
      .innerJoin("procurement.orderRequest", "request")
      .innerJoin("request.harvestListing", "listing")
      .innerJoin("listing.farmerProfile", "farmer")
      .innerJoin("request.priceOffer", "offer")
      .innerJoin("offer.factoryProfile", "factory")
      .addSelect([
        "request.id",
        "listing.id",
        "listing.teaGrade",
        "farmer.id",
        "farmer.gardenName",
        "farmer.district",
        "offer.id",
        "factory.id",
        "factory.factoryName",
        "factory.district",
      ]);
  }

  private scopeToParticipant(
    query: SelectQueryBuilder<Order>,
    actor: AuthUser,
  ): void {
    const profile = actor.role === Role.GROWER ? "farmer" : "factory";
    query.andWhere(`${profile}.userId = :userId`, { userId: actor.id });
  }

  private requireOrderId(id: number): void {
    if (id < 1 || id > 2147483647)
      throw new NotFoundException("Order not found");
  }

  private toResponse({ orderRequest, ...order }: Order) {
    const listing = orderRequest!.harvestListing!;
    const farmer = listing.farmerProfile!;
    const offer = orderRequest!.priceOffer!;
    const factory = offer.factoryProfile!;
    return {
      ...order,
      priceOfferId: offer.id,
      harvestListing: { id: listing.id, teaGrade: listing.teaGrade },
      farmerProfile: {
        id: farmer.id,
        gardenName: farmer.gardenName,
        district: farmer.district,
      },
      factoryProfile: {
        id: factory.id,
        factoryName: factory.factoryName,
        district: factory.district,
      },
    };
  }
}
