import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository, SelectQueryBuilder } from "typeorm";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { OfferStatus } from "@/common/enums/offer-status.enum";
import { dateInBangladesh } from "@/common/utilities/bangladesh-date";
import { FactoryVerificationService } from "@/modules/factory-profiles/factory-verification.service";
import { FactoryProfilesService } from "@/modules/factory-profiles/factory-profiles.service";
import { CreatePriceOfferDto } from "./dto/create-price-offer.dto";
import { UpdatePriceOfferDto } from "./dto/update-price-offer.dto";
import { QueryPriceOffersDto } from "./dto/query-price-offers.dto";
import { QueryOwnPriceOffersDto } from "./dto/query-own-price-offers.dto";
import { PriceOffer } from "./entities/price-offer.entity";

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(PriceOffer)
    private readonly offers: Repository<PriceOffer>,
    private readonly verification: FactoryVerificationService,
    private readonly factoryProfiles: FactoryProfilesService,
  ) {}

  async findActive(query: QueryPriceOffersDto) {
    const { teaGrade, minPrice, maxPrice, sortBy, sortOrder } = query;
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException(
        "minPrice must be less than or equal to maxPrice",
      );
    }
    const offers = this.browsableOffers();

    if (teaGrade !== undefined) {
      offers.andWhere("LOWER(offer.teaGrade) = LOWER(:teaGrade)", { teaGrade });
    }
    if (minPrice !== undefined) {
      offers.andWhere("offer.pricePerKg >= :minPrice", { minPrice });
    }
    if (maxPrice !== undefined) {
      offers.andWhere("offer.pricePerKg <= :maxPrice", { maxPrice });
    }

    offers
      .orderBy(`offer.${sortBy}`, sortOrder, "NULLS LAST")
      .addOrderBy("offer.id", sortOrder);
    const { data, ...pagination } = await this.paginate(offers, query);
    return { data: data.map(this.publicOffer), ...pagination };
  }

  async findActiveById(id: number) {
    if (id < 1 || id > 2147483647) {
      throw new NotFoundException("Offer not found");
    }
    const offer = await this.browsableOffers()
      .andWhere("offer.id = :id", { id })
      .getOne();
    if (!offer) throw new NotFoundException("Offer not found");
    return this.publicOffer(offer);
  }

  async findOwn(userId: number, query: QueryOwnPriceOffersDto) {
    const factory = await this.factoryProfiles.getOwnProfile(userId);
    const offers = this.offers
      .createQueryBuilder("offer")
      .where("offer.factoryProfileId = :factoryProfileId", {
        factoryProfileId: factory.id,
      })
      .orderBy("offer.createdAt", "DESC")
      .addOrderBy("offer.id", "DESC");
    if (query.status !== undefined) {
      offers.andWhere("offer.status = :status", { status: query.status });
    }
    return this.paginate(offers, query);
  }

  private browsableOffers() {
    // বাংলাদেশের সময় অনুযায়ী মেয়াদের শেষ দিন পর্যন্ত অফারটি দেখা যাবে।
    return this.offers
      .createQueryBuilder("offer")
      .innerJoin("offer.factoryProfile", "factory")
      .addSelect(["factory.id", "factory.factoryName", "factory.district"])
      .where("offer.status = :status", { status: OfferStatus.ACTIVE })
      .andWhere("offer.validUntil >= :today", {
        today: dateInBangladesh(),
      });
  }

  private publicOffer({
    id,
    teaGrade,
    pricePerKg,
    qualityRequirements,
    minimumQuantityKg,
    validUntil,
    estimatedTransportCostBdt,
    status,
    factoryProfile,
    createdAt,
  }: PriceOffer) {
    const factory = factoryProfile!;
    return {
      id,
      teaGrade,
      pricePerKg,
      qualityRequirements,
      minimumQuantityKg,
      validUntil,
      estimatedTransportCostBdt,
      status,
      createdAt,
      factoryProfile: {
        id: factory.id,
        factoryName: factory.factoryName,
        district: factory.district,
      },
    };
  }

  private async paginate(
    offers: SelectQueryBuilder<PriceOffer>,
    { page, limit }: Pick<QueryPriceOffersDto, "page" | "limit">,
  ) {
    const offset = (page - 1) * limit;
    if (!Number.isSafeInteger(offset)) {
      throw new BadRequestException("Requested page is out of range");
    }
    // প্রতি অফারের জন্য একটি মাত্র সারি থাকে, তাই limit ও offset যথেষ্ট।
    const [data, total] = await offers
      .offset(offset)
      .limit(limit)
      .getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async publish(
    actor: AuthUser,
    dto: CreatePriceOfferDto,
  ): Promise<PriceOffer> {
    const factory = await this.verification.requireVerifiedFactory(actor);
    // অফারের তারিখ বাংলাদেশের স্থানীয় দিন অনুযায়ী যাচাই হয়।
    if (dto.validUntil <= dateInBangladesh()) {
      throw new BadRequestException(
        "validUntil must be after today in Bangladesh",
      );
    }
    return this.offers.save(
      this.offers.create({
        factoryProfileId: factory.id,
        teaGrade: dto.teaGrade,
        pricePerKg: dto.pricePerKg,
        qualityRequirements: dto.qualityRequirements ?? null,
        minimumQuantityKg: dto.minimumQuantityKg ?? null,
        validUntil: dto.validUntil,
        estimatedTransportCostBdt: dto.estimatedTransportCostBdt ?? null,
        notes: dto.notes ?? null,
        status: OfferStatus.ACTIVE,
      }),
    );
  }

  async update(
    actor: AuthUser,
    id: number,
    changes: UpdatePriceOfferDto,
  ): Promise<PriceOffer> {
    const factory = await this.verification.requireVerifiedFactory(actor);
    return this.changeActiveOffer(id, factory.id, changes);
  }

  async withdraw(actor: AuthUser, id: number): Promise<PriceOffer> {
    const factory = await this.factoryProfiles.getOwnProfile(actor.id);
    return this.changeActiveOffer(id, factory.id, {
      status: OfferStatus.WITHDRAWN,
    });
  }

  async expireOffers(now = new Date()): Promise<number> {
    // শুধু মেয়াদ পেরোনো সক্রিয় অফার বদলায়। একই কাজ আবার চালালেও আগের সিদ্ধান্ত বদলায় না।
    const result = await this.offers.update(
      {
        status: OfferStatus.ACTIVE,
        validUntil: LessThan(dateInBangladesh(now)),
      },
      { status: OfferStatus.EXPIRED },
    );
    return result.affected ?? 0;
  }

  private async changeActiveOffer(
    id: number,
    factoryProfileId: number,
    changes: UpdatePriceOfferDto | { status: OfferStatus.WITHDRAWN },
  ): Promise<PriceOffer> {
    if (id < 1 || id > 2147483647) {
      throw new NotFoundException("Offer not found");
    }
    return this.offers.manager.transaction(async (manager) => {
      const repository = manager.getRepository(PriceOffer);
      // লক নেওয়ার পরে অবস্থা ও তারিখ দেখি, যাতে মেয়াদ শেষ হওয়া বা প্রত্যাহারের সঙ্গে সংঘর্ষ না হয়।
      const offer = await repository.findOne({
        where: { id },
        lock: { mode: "pessimistic_write" },
      });
      if (!offer) throw new NotFoundException("Offer not found");
      if (offer.factoryProfileId !== factoryProfileId) {
        throw new ForbiddenException("You do not own this offer");
      }
      const today = dateInBangladesh();
      if (offer.status !== OfferStatus.ACTIVE || offer.validUntil < today) {
        throw new ConflictException(
          "Only active, unexpired offers can be changed",
        );
      }
      if (
        "validUntil" in changes &&
        changes.validUntil !== undefined &&
        changes.validUntil <= today
      ) {
        throw new BadRequestException(
          "validUntil must be after today in Bangladesh",
        );
      }
      return repository.save(repository.merge(offer, changes));
    });
  }
}
