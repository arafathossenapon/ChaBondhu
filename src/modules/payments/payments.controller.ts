import {
  Body,
  Headers,
  Patch,
  Post,
  Query,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import { JwtGuard } from "@/common/guard/jwt.guard";
import { RolesGuard } from "@/common/guard/roles.guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { PaymentsService } from "./payments.service";

import {
  ConfirmPaymentDto,
  QueryPaymentsDto,
  RejectPaymentDto,
  SubmitPaymentDto,
} from "./payment.dto";
import { ReceiptDecision } from "./entities/payment-attempt.entity";

@ApiTags("payments")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Required role missing" })
@ApiResponse({ status: 404, description: "Order missing or private" })
@UseGuards(JwtGuard, RolesGuard)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("order/:orderId/amount")
  @Roles(Role.FACTORY, Role.GROWER, Role.ADMIN)
  @ApiOperation({
    summary: "Read the exact BDT amount payable for a collected order",
  })
  @ApiResponse({
    status: 200,
    description:
      "Payable amount as a two-decimal BDT string with order ID and payment status",
  })
  @ApiResponse({
    status: 409,
    description: "Order is not collected or has no positive payable amount",
  })
  amount(
    @CurrentUser() actor: AuthUser,
    @Param("orderId", ParseIntPipe) id: number,
  ) {
    return this.payments.amount(actor, id);
  }
  @Post("order/:orderId/attempts")
  @Roles(Role.FACTORY)
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiResponse({
    status: 201,
    description:
      "New attempt or original submission response for an identical retry",
  })
  @ApiResponse({
    status: 409,
    description: "Ineligible order, duplicate reference, or conflicting retry",
  })
  submit(
    @CurrentUser() actor: AuthUser,
    @Param("orderId", ParseIntPipe) id: number,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: SubmitPaymentDto,
  ) {
    return this.payments.submit(actor, id, key, dto);
  }

  @Get("my")
  @Roles(Role.FACTORY, Role.GROWER)
  @ApiOperation({ summary: "List your payment settlements" })
  list(@CurrentUser() actor: AuthUser, @Query() query: QueryPaymentsDto) {
    return this.payments.list(actor, query);
  }

  @Get("order/:orderId")
  @Roles(Role.FACTORY, Role.GROWER, Role.ADMIN)
  @ApiOperation({ summary: "Read a private settlement for an order" })
  details(
    @CurrentUser() actor: AuthUser,
    @Param("orderId", ParseIntPipe) id: number,
  ) {
    return this.payments.details(actor, id);
  }

  @Get("order/:orderId/history")
  @Roles(Role.FACTORY, Role.GROWER, Role.ADMIN)
  @ApiOperation({
    summary: "Read paginated payment submissions and receipt decisions",
  })
  history(
    @CurrentUser() actor: AuthUser,
    @Param("orderId", ParseIntPipe) id: number,
    @Query() query: QueryPaymentsDto,
  ) {
    return this.payments.history(actor, id, query);
  }

  @Patch("order/:orderId/attempts/:attemptId/confirm")
  @Roles(Role.GROWER)
  @ApiOperation({ summary: "Confirm receipt of a submitted payment" })
  @ApiResponse({ status: 409, description: "Attempt cannot be confirmed" })
  confirm(
    @CurrentUser() actor: AuthUser,
    @Param("orderId", ParseIntPipe) id: number,
    @Param("attemptId", ParseIntPipe) attemptId: number,
    @Body() _body: ConfirmPaymentDto,
  ) {
    return this.payments.decide(
      actor,
      id,
      attemptId,
      ReceiptDecision.CONFIRMED,
      null,
    );
  }

  @Patch("order/:orderId/attempts/:attemptId/reject")
  @Roles(Role.GROWER)
  @ApiOperation({ summary: "Reject a submitted payment with a reason" })
  @ApiResponse({ status: 409, description: "Attempt cannot be rejected" })
  reject(
    @CurrentUser() actor: AuthUser,
    @Param("orderId", ParseIntPipe) id: number,
    @Param("attemptId", ParseIntPipe) attemptId: number,
    @Body() dto: RejectPaymentDto,
  ) {
    return this.payments.decide(
      actor,
      id,
      attemptId,
      ReceiptDecision.REJECTED,
      dto.rejectionReason,
    );
  }
}

@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Controller("admin/payments")
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: "List payment settlements for read-only admin oversight",
  })
  list(@CurrentUser() actor: AuthUser, @Query() query: QueryPaymentsDto) {
    return this.payments.list(actor, query);
  }
}
