import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
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
import { QueryOrdersDto } from "./dto/query-orders.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { OrdersService } from "./orders.service";

@ApiTags("orders")
@ApiBearerAuth()
@ApiResponse({ status: 400, description: "Invalid input" })
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Required role missing" })
@ApiResponse({
  status: 404,
  description: "Order not found or outside the caller's ownership",
})
@UseGuards(JwtGuard, RolesGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get("my")
  @Roles(Role.GROWER, Role.FACTORY)
  @ApiOperation({
    summary: "List confirmed orders for your grower or factory profile",
  })
  @ApiResponse({
    status: 200,
    description:
      "Paginated list of orders with independent order and payment statuses",
  })
  listOwn(@CurrentUser() actor: AuthUser, @Query() query: QueryOrdersDto) {
    return this.orders.listOwn(actor, query);
  }

  @Get(":id")
  @Roles(Role.GROWER, Role.FACTORY, Role.ADMIN)
  @ApiOperation({ summary: "Read an order as a participant or an admin" })
  @ApiResponse({
    status: 200,
    description: "Order with listing and participant summaries",
  })
  findOne(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.orders.findOne(actor, id);
  }

  @Patch(":id/status")
  @Roles(Role.GROWER, Role.FACTORY)
  @ApiOperation({
    summary: "Cancel before pickup, schedule pickup, or record collection",
  })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiResponse({
    status: 200,
    description:
      "Updated order. Payment status and agreed snapshots are preserved.",
  })
  @ApiResponse({
    status: 409,
    description: "Order cannot move to the requested status",
  })
  updateStatus(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(actor, id, dto);
  }
}
