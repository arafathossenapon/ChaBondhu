import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { OfferStatus } from "@/common/enums/offer-status.enum";
import { FactoryVerificationService } from "@/modules/factory-profiles/factory-verification.service";
import { CreatePriceOfferDto } from "./dto/create-price-offer.dto";
import { QueryPriceOffersDto } from "./dto/query-price-offers.dto";
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
  ) {}

  async findActive(query: QueryPriceOffersDto) {
    const { teaGrade, minPrice, maxPrice, page, limit, sortBy, sortOrder } =
      query;
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException(
        "minPrice must be less than or equal to maxPrice",
      );
    }
    const offset = (page - 1) * limit;
    if (!Number.isSafeInteger(offset)) {
      throw new BadRequestException("Requested page is out of range");
    }

    // মেয়াদের শেষ দিন পর্যন্ত অফারটি দেখা যাবে। দিন বদলালে তালিকা নিজেই হালনাগাদ হয়।
    const offers = this.offers
      .createQueryBuilder("offer")
      .innerJoin("offer.factoryProfile", "factory")
      .addSelect(["factory.id", "factory.factoryName", "factory.district"])
      .where("offer.status = :status", { status: OfferStatus.ACTIVE })
      .andWhere("offer.validUntil >= :today", {
        today: bangladeshDate.format(new Date()),
      });

    if (teaGrade !== undefined) {
      offers.andWhere("LOWER(offer.teaGrade) = LOWER(:teaGrade)", { teaGrade });
    }
    if (minPrice !== undefined) {
      offers.andWhere("offer.pricePerKg >= :minPrice", { minPrice });
    }
    if (maxPrice !== undefined) {
      offers.andWhere("offer.pricePerKg <= :maxPrice", { maxPrice });
    }

    // এই join-এ প্রতি অফারে একটি মাত্র সারি থাকে, তাই সরাসরি limit ও offset যথেষ্ট।
    const [rows, total] = await offers
      .orderBy(`offer.${sortBy}`, sortOrder, "NULLS LAST")
      .addOrderBy("offer.id", sortOrder)
      .offset(offset)
      .limit(limit)
      .getManyAndCount();

    return {
      data: rows.map(
        ({
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
        }) => ({
          id,
          teaGrade,
          pricePerKg,
          qualityRequirements,
          minimumQuantityKg,
          validUntil,
          estimatedTransportCostBdt,
          status,
          factoryProfile: {
            id: factoryProfile!.id,
            factoryName: factoryProfile!.factoryName,
            district: factoryProfile!.district,
          },
          createdAt,
        }),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
