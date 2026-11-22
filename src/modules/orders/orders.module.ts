import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrderRequest } from "./entities/order-request.entity";
import { Order } from "./entities/order.entity";
import { OrderRequestsController } from "./order-requests.controller";
import { OrderRequestsService } from "./order-requests.service";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [TypeOrmModule.forFeature([OrderRequest, Order])],
  controllers: [OrderRequestsController, OrdersController],
  providers: [OrderRequestsService, OrdersService],
})
export class OrdersModule {}
