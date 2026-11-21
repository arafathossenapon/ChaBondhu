import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FactoryProfilesModule } from "@/modules/factory-profiles/factory-profiles.module";
import { PriceOffer } from "./entities/price-offer.entity";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";
import { OfferExpiryJob } from "./offer-expiry.job";

@Module({
  imports: [TypeOrmModule.forFeature([PriceOffer]), FactoryProfilesModule],
  controllers: [OffersController],
  providers: [OffersService, OfferExpiryJob],
})
export class OffersModule {}
