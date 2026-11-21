import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FactoryProfile } from "./entities/factory-profile.entity";
import { FactoryProfilesService } from "./factory-profiles.service";
import { FactoryProfilesController } from "./factory-profiles.controller";
import { FactoryVerificationController } from "./factory-verification.controller";
import { FactoryVerificationService } from "./factory-verification.service";

@Module({
  imports: [TypeOrmModule.forFeature([FactoryProfile])],
  controllers: [FactoryProfilesController, FactoryVerificationController],
  providers: [FactoryProfilesService, FactoryVerificationService],
  exports: [FactoryProfilesService, FactoryVerificationService, TypeOrmModule],
})
export class FactoryProfilesModule {}
