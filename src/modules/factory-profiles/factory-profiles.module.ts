import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FactoryProfile } from "./entities/factory-profile.entity";
import { FactoryProfilesService } from "./factory-profiles.service";
import { FactoryProfilesController } from "./factory-profiles.controller";

@Module({
  imports: [TypeOrmModule.forFeature([FactoryProfile])],
  controllers: [FactoryProfilesController],
  providers: [FactoryProfilesService],
  exports: [FactoryProfilesService, TypeOrmModule],
})
export class FactoryProfilesModule {}
