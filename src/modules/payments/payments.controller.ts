import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
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
}
