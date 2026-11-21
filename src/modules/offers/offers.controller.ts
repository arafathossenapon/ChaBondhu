import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
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
import { CreatePriceOfferDto } from "./dto/create-price-offer.dto";
import { QueryPriceOffersDto } from "./dto/query-price-offers.dto";
import { OffersService } from "./offers.service";

@ApiTags("offers")
@ApiBearerAuth()
@Controller("offers")
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: "Browse active buying offers (any signed-in user)" })
  @ApiResponse({
    status: 200,
    description:
      "Matching active offers with total, page, limit and totalPages",
    schema: {
      example: {
        data: [
          {
            id: 5,
            teaGrade: "CTC",
            pricePerKg: 28.5,
            qualityRequirements: null,
            minimumQuantityKg: 100,
            validUntil: "2099-12-31",
            estimatedTransportCostBdt: 500,
            status: "ACTIVE",
            factoryProfile: {
              id: 2,
              factoryName: "Panchagarh Tea Processing Ltd.",
              district: "Panchagarh",
            },
            createdAt: "2026-11-21T10:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid query parameters or inverted price range",
  })
  @ApiResponse({ status: 401, description: "Authentication required" })
  findActive(@Query() query: QueryPriceOffersDto) {
    return this.offers.findActive(query);
  }

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.FACTORY)
  @ApiOperation({
    summary: "Publish a buying offer for a tea grade (verified factory only)",
  })
  @ApiResponse({
    status: 201,
    description: "Price offer published with ACTIVE status",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request fields or expiry date",
  })
  @ApiResponse({ status: 401, description: "Authentication required" })
  @ApiResponse({
    status: 403,
    description: "Factory role and approved verification required",
  })
  @ApiResponse({
    status: 404,
    description: "The factory account has no factory profile",
  })
  publish(@CurrentUser() actor: AuthUser, @Body() dto: CreatePriceOfferDto) {
    return this.offers.publish(actor, dto);
  }
}
