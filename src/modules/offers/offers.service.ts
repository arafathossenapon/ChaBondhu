import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { OfferStatus } from "@/common/enums/offer-status.enum";
import { FactoryVerificationService } from "@/modules/factory-profiles/factory-verification.service";
import { CreatePriceOfferDto } from "./dto/create-price-offer.dto";
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
