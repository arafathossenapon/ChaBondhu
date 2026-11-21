import { Body, Controller, Post, UseGuards } from "@nestjs/common";
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
import { OffersService } from "./offers.service";

@ApiTags("offers")
@ApiBearerAuth()
@Controller("offers")
export class OffersController {
  constructor(private readonly offers: OffersService) {}

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
