import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ListingsService } from "./listings.service";
import { CreateHarvestListingDto } from "./dto/create-harvest-listing.dto";
import { UpdateHarvestListingDto } from "./dto/update-harvest-listing.dto";
import { QueryHarvestListingDto } from "./dto/query-harvest-listing.dto";
import { JwtGuard } from "@/common/guard/jwt.guard";
import { RolesGuard } from "@/common/guard/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Role } from "@/common/enums/role.enum";
import { AuthUser } from "@/common/interfaces/auth-user.interface";

@ApiTags("listings")
@ApiBearerAuth()
@Controller("listings")
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.GROWER)
  @ApiOperation({ summary: "Create a harvest listing (GROWER only)" })
  @ApiResponse({ status: 201, description: "Harvest listing created successfully" })
  @ApiResponse({ status: 400, description: "Bad Request - missing or invalid fields" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 403, description: "Forbidden - user is not a GROWER" })
  @ApiResponse({ status: 404, description: "Not Found - farmer has no farm profile" })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() createDto: CreateHarvestListingDto,
  ) {
    return this.listingsService.create(user.id, createDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: "Browse all active harvest listings (Marketplace view)" })
  @ApiResponse({ status: 200, description: "List of active harvest listings" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  async findAll(@Query() queryDto: QueryHarvestListingDto) {
    return this.listingsService.findAllActive(queryDto);
  }

  @Get("my")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.GROWER)
  @ApiOperation({ summary: "Get own harvest listings (GROWER only)" })
  @ApiResponse({ status: 200, description: "List of authenticated farmer's own listings" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 403, description: "Forbidden - user is not a GROWER" })
  async findMyListings(@CurrentUser() user: AuthUser) {
    return this.listingsService.findOwnListings(user.id);
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: "Get single harvest listing details" })
  @ApiResponse({ status: 200, description: "Harvest listing details" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 404, description: "Not Found - listing not found or inactive" })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listingsService.findById(id, user);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.GROWER)
  @ApiOperation({ summary: "Update harvest listing (owner only, active only)" })
  @ApiResponse({ status: 200, description: "Listing updated successfully" })
  @ApiResponse({ status: 400, description: "Bad Request - invalid field values" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 403, description: "Forbidden - user is not the listing owner" })
  @ApiResponse({ status: 404, description: "Not Found - listing not found" })
  @ApiResponse({ status: 409, description: "Conflict - listing is not in ACTIVE status" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() updateDto: UpdateHarvestListingDto,
  ) {
    return this.listingsService.update(id, user.id, updateDto);
  }

  @Patch(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.GROWER)
  @ApiOperation({ summary: "Cancel harvest listing (owner only)" })
  @ApiResponse({ status: 200, description: "Listing cancelled successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 403, description: "Forbidden - user is not the listing owner" })
  @ApiResponse({ status: 404, description: "Not Found - listing not found" })
  @ApiResponse({ status: 409, description: "Conflict - listing cannot be cancelled" })
  async cancel(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listingsService.cancel(id, user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Soft-delete / deactivate listing for moderation (ADMIN only)" })
  @ApiResponse({ status: 200, description: "Listing deactivated successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 403, description: "Forbidden - user is not an ADMIN" })
  @ApiResponse({ status: 404, description: "Not Found - listing not found" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.listingsService.softDelete(id);
  }
}
