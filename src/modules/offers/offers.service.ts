import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { OfferStatus } from "@/common/enums/offer-status.enum";
import { FactoryVerificationService } from "@/modules/factory-profiles/factory-verification.service";
import { FactoryProfilesService } from "@/modules/factory-profiles/factory-profiles.service";
import { CreatePriceOfferDto } from "./dto/create-price-offer.dto";
import { QueryPriceOffersDto } from "./dto/query-price-offers.dto";
import { QueryOwnPriceOffersDto } from "./dto/query-own-price-offers.dto";
import { PriceOffer } from "./entities/price-offer.entity";

const bangladeshDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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
        today: bangladeshDate.format(new Date()),
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
    if (dto.validUntil <= bangladeshDate.format(new Date())) {
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
}
