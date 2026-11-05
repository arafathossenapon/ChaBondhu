import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PostgresDatabaseProviderModule } from "@/providers/database/postgres/provider.module";
import { AppController } from "@/src/app.controller";
import { AppService } from "@/src/app.service";
import global_config from "@/config/global_config";
import { UsersModule } from "@/modules/users/users.module";
import { AuthModule } from "@/modules/auth/auth.module";
import { FarmerProfilesModule } from "@/modules/farmer-profiles/farmer-profiles.module";
import { FactoryProfilesModule } from "@/modules/factory-profiles/factory-profiles.module";
import { ListingsModule } from "@/modules/listings/listings.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [global_config],
    }),
    PostgresDatabaseProviderModule,
    UsersModule,
    AuthModule,
    FarmerProfilesModule,
    FactoryProfilesModule,
    ListingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
