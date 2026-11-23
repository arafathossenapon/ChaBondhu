import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "@/modules/orders/entities/order.entity";
import { Payment } from "./entities/payment.entity";
import { PaymentAttempt } from "./entities/payment-attempt.entity";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [TypeOrmModule.forFeature([Order, Payment, PaymentAttempt])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
