import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository, SelectQueryBuilder } from "typeorm";
import { ListingStatus } from "@/common/enums/listing-status.enum";
import { OfferStatus } from "@/common/enums/offer-status.enum";
import { dateInBangladesh } from "@/common/utilities/bangladesh-date";
import { FactoryProfile } from "@/modules/factory-profiles/entities/factory-profile.entity";
import { FarmerProfile } from "@/modules/farmer-profiles/entities/farmer-profile.entity";
import { HarvestListing } from "@/modules/listings/entities/harvest-listing.entity";
import { lockHarvestListing } from "@/modules/listings/lock-harvest-listing";
import { PriceOffer } from "@/modules/offers/entities/price-offer.entity";
import { closePendingRequests } from "./close-pending-requests";
import { CreateOrderRequestDto } from "./dto/create-order-request.dto";
import { QueryOrderRequestsDto } from "./dto/query-order-requests.dto";
import { OrderRequest } from "./entities/order-request.entity";
import { Order } from "./entities/order.entity";
import { OrderRequestClosureReason, OrderRequestStatus } from "./order-status";

type RequestDecision =
  | OrderRequestStatus.ACCEPTED
  | OrderRequestStatus.REJECTED
  | OrderRequestStatus.WITHDRAWN;

@Injectable()
export class OrderRequestsService {
  constructor(
    @InjectRepository(OrderRequest)
    private readonly requests: Repository<OrderRequest>,
  ) {}

  async submit(userId: number, dto: CreateOrderRequestDto) {
    return this.requests.manager.transaction(async (manager) => {
      const listing = await lockHarvestListing(manager, dto.harvestListingId);
      const offer = await this.lockOffer(manager, dto.priceOfferId);
      const factory = await this.lockFactory(manager, offer.factoryProfileId);
      if (!factory || factory.userId !== userId)
        throw new NotFoundException("Price offer not found");
      if (!factory.isVerified)
        throw new ForbiddenException("Factory verification is required");
      this.requireEligibility(listing, offer);

      // একই তালিকার লক থাকায় একই কারখানার দুটি অনুরোধ একসঙ্গে জমা হতে পারে না।
      const alreadyPending = await this.requestQuery(manager)
        .where("request.harvestListingId = :listingId", {
          listingId: listing.id,
        })
        .andWhere("offer.factoryProfileId = :factoryId", {
          factoryId: factory.id,
        })
        .andWhere("request.status = :status", {
          status: OrderRequestStatus.PENDING,
        })
        .getExists();
      if (alreadyPending)
        throw new ConflictException(
          "This factory already has a pending request for the listing",
        );

      const request = await manager.save(OrderRequest, {
        harvestListingId: listing.id,
        priceOfferId: offer.id,
        quotedPricePerKg: offer.pricePerKg,
        status: OrderRequestStatus.PENDING,
        closureReason: null,
      });
      return this.requestDetails(manager, request.id);
    });
  }

  async listForListing(
    userId: number,
    listingId: number,
    query: QueryOrderRequestsDto,
  ) {
    if (
      listingId < 1 ||
      listingId > 2147483647 ||
      !(await this.requests.manager.exists(HarvestListing, {
        where: { id: listingId, farmerProfile: { userId } },
      }))
    )
      throw new NotFoundException("Harvest listing not found");
    return this.paginate(
      this.requestQuery(this.requests.manager).where(
        "request.harvestListingId = :listingId",
        { listingId },
      ),
      query,
    );
  }

  async listForFactory(userId: number, query: QueryOrderRequestsDto) {
    return this.paginate(
      this.requestQuery(this.requests.manager).where(
        "factory.userId = :userId",
        { userId },
      ),
      query,
    );
  }

  async accept(userId: number, requestId: number) {
    return this.requests.manager.transaction(async (manager) => {
      const { request, listing } = await this.lockRequest(
        manager,
        requestId,
        userId,
        OrderRequestStatus.ACCEPTED,
      );
      if (request.status === OrderRequestStatus.ACCEPTED) {
        const order = await manager.findOneByOrFail(Order, {
          orderRequestId: request.id,
        });
        return {
          request: await this.requestDetails(manager, request.id),
          order,
        };
      }
      this.requirePending(request);
      const offer = await this.lockOffer(manager, request.priceOfferId);
      const factory = await this.lockFactory(manager, offer.factoryProfileId);
      if (!factory?.isVerified)
        throw new ConflictException(
          "The requesting factory is no longer eligible",
        );
      this.requireEligibility(listing, offer);

      // চারটি পরিবর্তন একই ট্রানজ্যাকশনে হয়; কোনোটি ব্যর্থ হলে সবগুলো বাতিল হয়।
      const order = await manager.save(Order, {
        orderRequestId: request.id,
        harvestListingId: listing.id,
        agreedPricePerKg: request.quotedPricePerKg,
        estimatedQuantityKg: listing.estimatedQuantityKg,
        actualCollectedWeightKg: null,
        proposedCollectionDate: null,
        collectionPoint: null,
        pickupNotes: null,
        estimatedTransportCostBdt: null,
      });
      await manager.update(OrderRequest, request.id, {
        status: OrderRequestStatus.ACCEPTED,
      });
      await manager.update(HarvestListing, listing.id, {
        status: ListingStatus.RESERVED,
      });
      await closePendingRequests(
        manager,
        listing.id,
        OrderRequestClosureReason.ANOTHER_REQUEST_ACCEPTED,
      );
      return { request: await this.requestDetails(manager, request.id), order };
    });
  }

  async reject(userId: number, requestId: number) {
    return this.resolvePending(userId, requestId, OrderRequestStatus.REJECTED);
  }

  async withdraw(userId: number, requestId: number) {
    return this.resolvePending(userId, requestId, OrderRequestStatus.WITHDRAWN);
  }

  private resolvePending(
    userId: number,
    requestId: number,
    status: OrderRequestStatus.REJECTED | OrderRequestStatus.WITHDRAWN,
  ) {
    return this.requests.manager.transaction(async (manager) => {
      const { request } = await this.lockRequest(
        manager,
        requestId,
        userId,
        status,
      );
      this.requirePending(request);
      await manager.update(OrderRequest, request.id, { status });
      return this.requestDetails(manager, request.id);
    });
  }

  private async lockRequest(
    manager: EntityManager,
    requestId: number,
    userId: number,
    decision: RequestDecision,
  ) {
    if (requestId < 1 || requestId > 2147483647)
      throw new NotFoundException("Order request not found");
    // অনুরোধের তালিকা বদলায় না। প্রথমে শুধু আইডি পড়ি, তারপর তালিকার লক নিই।
    const reference = await manager.findOne(OrderRequest, {
      where: { id: requestId },
      select: { harvestListingId: true },
    });
    if (!reference) throw new NotFoundException("Order request not found");
    const listing = await lockHarvestListing(
      manager,
      reference.harvestListingId,
    );
    const request = await manager.findOneByOrFail(OrderRequest, {
      id: requestId,
    });
    const ownsRequest =
      decision === OrderRequestStatus.WITHDRAWN
        ? await manager.exists(PriceOffer, {
            where: { id: request.priceOfferId, factoryProfile: { userId } },
          })
        : await manager.existsBy(FarmerProfile, {
            id: listing.farmerProfileId,
            userId,
          });
    if (!ownsRequest) throw new NotFoundException("Order request not found");
    return { request, listing };
  }

  private async lockOffer(
    manager: EntityManager,
    id: number,
  ): Promise<PriceOffer> {
    const offer = await manager.findOne(PriceOffer, {
      where: { id },
      lock: { mode: "pessimistic_read" },
    });
    if (!offer) throw new NotFoundException("Price offer not found");
    return offer;
  }

  private lockFactory(manager: EntityManager, id: number) {
    return manager
      .getRepository(FactoryProfile)
      .createQueryBuilder("factory")
      .innerJoin("factory.user", "account")
      .where("factory.id = :id AND account.isActive = true", { id })
      .setLock("pessimistic_read", undefined, ["factory", "account"])
      .getOne();
  }

  private requirePending(request: OrderRequest): void {
    if (request.status !== OrderRequestStatus.PENDING)
      throw new ConflictException("Only pending requests can be changed");
  }

  private requireEligibility(listing: HarvestListing, offer: PriceOffer): void {
    if (!listing.isActive || listing.status !== ListingStatus.ACTIVE)
      throw new ConflictException("Harvest listing is no longer available");
    if (
      offer.status !== OfferStatus.ACTIVE ||
      offer.validUntil < dateInBangladesh()
    )
      throw new ConflictException("Price offer is no longer eligible");
    if (
      listing.teaGrade.trim().toLowerCase() !==
      offer.teaGrade.trim().toLowerCase()
    )
      throw new ConflictException(
        "The offer and listing tea grades must match",
      );
    if (
      offer.minimumQuantityKg !== null &&
      offer.minimumQuantityKg > listing.estimatedQuantityKg
    ) {
      throw new ConflictException(
        "Estimated harvest is below the offer's minimum quantity",
      );
    }
  }

  private requestQuery(manager: EntityManager) {
    return manager
      .getRepository(OrderRequest)
      .createQueryBuilder("request")
      .innerJoin("request.harvestListing", "listing")
      .innerJoin("request.priceOffer", "offer")
      .innerJoin("offer.factoryProfile", "factory")
      .addSelect([
        "listing.id",
        "listing.teaGrade",
        "listing.estimatedQuantityKg",
        "offer.id",
        "factory.id",
        "factory.factoryName",
        "factory.district",
      ]);
  }

  private async requestDetails(manager: EntityManager, id: number) {
    const row = await this.requestQuery(manager)
      .where("request.id = :id", { id })
      .getOneOrFail();
    return this.toResponse(row);
  }

  private async paginate(
    builder: SelectQueryBuilder<OrderRequest>,
    { status, page, limit }: QueryOrderRequestsDto,
  ) {
    if (status !== undefined)
      builder.andWhere("request.status = :status", { status });
    const [rows, total] = await builder
      .orderBy("request.createdAt", "DESC")
      .addOrderBy("request.id", "DESC")
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

  private toResponse({ harvestListing, priceOffer, ...request }: OrderRequest) {
    const listing = harvestListing!;
    const factory = priceOffer!.factoryProfile!;
    return {
      ...request,
      harvestListing: {
        id: listing.id,
        teaGrade: listing.teaGrade,
        estimatedQuantityKg: listing.estimatedQuantityKg,
      },
      factoryProfile: {
        id: factory.id,
        factoryName: factory.factoryName,
        district: factory.district,
      },
    };
  }
}
