import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
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
import { CreateOrderRequestDto } from "./dto/create-order-request.dto";
import { QueryOrderRequestsDto } from "./dto/query-order-requests.dto";
import { OrderRequestsService } from "./order-requests.service";

@ApiTags("order-requests")
@ApiBearerAuth()
@ApiResponse({ status: 400, description: "Invalid input" })
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({
  status: 403,
  description: "Required role or verification missing",
})
@ApiResponse({
  status: 404,
  description: "Resource not found or outside the caller's ownership",
})
@UseGuards(JwtGuard, RolesGuard)
@Controller()
export class OrderRequestsController {
  constructor(private readonly requests: OrderRequestsService) {}

  @Post("order-requests")
  @Roles(Role.FACTORY)
  @ApiOperation({
    summary: "Submit a request and snapshot the price of your eligible offer",
  })
  @ApiResponse({
    status: 201,
    description: "Pending request with its quoted price",
  })
  @ApiResponse({
    status: 409,
    description:
      "Listing or offer is ineligible, or the factory already has a pending request",
  })
  submit(@CurrentUser() actor: AuthUser, @Body() dto: CreateOrderRequestDto) {
    return this.requests.submit(actor.id, dto);
  }

  @Get("listings/:id/order-requests")
  @Roles(Role.GROWER)
  @ApiOperation({
    summary: "List incoming requests for a harvest listing you own",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated requests with listing and factory summaries",
  })
  listForListing(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIntPipe) id: number,
    @Query() query: QueryOrderRequestsDto,
  ) {
    return this.requests.listForListing(actor.id, id, query);
  }

  @Get("order-requests/my")
  @Roles(Role.FACTORY)
  @ApiOperation({
    summary: "List requests submitted against your factory's offers",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated requests with listing and factory summaries",
  })
  listForFactory(
    @CurrentUser() actor: AuthUser,
    @Query() query: QueryOrderRequestsDto,
  ) {
    return this.requests.listForFactory(actor.id, query);
  }

  @Patch("order-requests/:id/accept")
  @Roles(Role.GROWER)
  @ApiOperation({
    summary: "Accept a request for your listing and reserve it atomically",
  })
  @ApiResponse({
    status: 200,
    description: "Accepted request and its confirmed order",
  })
  @ApiResponse({ status: 409, description: "Request cannot be accepted" })
  accept(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.requests.accept(actor.id, id);
  }

  @Patch("order-requests/:id/reject")
  @Roles(Role.GROWER)
  @ApiOperation({ summary: "Reject a pending request for your listing" })
  @ApiResponse({ status: 200, description: "Rejected request" })
  @ApiResponse({ status: 409, description: "Request is no longer pending" })
  reject(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.requests.reject(actor.id, id);
  }

  @Patch("order-requests/:id/withdraw")
  @Roles(Role.FACTORY)
  @ApiOperation({
    summary: "Withdraw a pending request submitted by your factory",
  })
  @ApiResponse({ status: 200, description: "Withdrawn request" })
  @ApiResponse({ status: 409, description: "Request is no longer pending" })
  withdraw(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.requests.withdraw(actor.id, id);
  }
}
