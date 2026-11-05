import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HarvestListing } from "./entities/harvest-listing.entity";
import { ListingsService } from "./listings.service";
import { ListingsController } from "./listings.controller";
import { FarmerProfilesModule } from "@/modules/farmer-profiles/farmer-profiles.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([HarvestListing]),
    FarmerProfilesModule,
  ],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService, TypeOrmModule],
})
export class ListingsModule {}
