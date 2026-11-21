import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
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
import { QueryOwnPriceOffersDto } from "./dto/query-own-price-offers.dto";
import { OffersService } from "./offers.service";

const offerExample = {
  id: 5,
  teaGrade: "CTC",
  pricePerKg: 28.5,
  qualityRequirements: null,
  minimumQuantityKg: 100,
  validUntil: "2099-12-31",
  estimatedTransportCostBdt: 500,
  status: "ACTIVE",
  createdAt: "2026-11-21T10:00:00.000Z",
};
const publicOfferExample = {
  ...offerExample,
  factoryProfile: {
    id: 2,
    factoryName: "Panchagarh Tea Processing Ltd.",
    district: "Panchagarh",
  },
};

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
        data: [publicOfferExample],
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

  @Get("my")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.FACTORY)
  @ApiOperation({
    summary: "List the signed-in factory's offers across all stored statuses",
  })
  @ApiResponse({
    status: 200,
    description: "Owned offer records with total, page, limit and totalPages",
    schema: {
      example: {
        data: [
          {
            ...offerExample,
            factoryProfileId: publicOfferExample.factoryProfile.id,
            notes: "Collection every Saturday.",
            updatedAt: offerExample.createdAt,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid query parameters" })
  @ApiResponse({ status: 401, description: "Authentication required" })
  @ApiResponse({ status: 403, description: "Factory role required" })
  @ApiResponse({ status: 404, description: "Factory profile not found" })
  findOwn(
    @CurrentUser() actor: AuthUser,
    @Query() query: QueryOwnPriceOffersDto,
  ) {
    return this.offers.findOwn(actor.id, query);
  }

  @Get(":id")
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: "Get a browsable buying offer by ID" })
  @ApiParam({ name: "id", type: Number, description: "Offer ID", example: 5 })
  @ApiResponse({
    status: 200,
    description: "Offer details using the same public fields as GET /offers",
    schema: { example: publicOfferExample },
  })
  @ApiResponse({ status: 400, description: "Invalid offer ID format" })
  @ApiResponse({ status: 401, description: "Authentication required" })
  @ApiResponse({
    status: 404,
    description: "Offer not found or unavailable for browsing",
  })
  findById(@Param("id", ParseIntPipe) id: number) {
    return this.offers.findActiveById(id);
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
