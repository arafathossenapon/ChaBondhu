import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { FarmerProfilesService } from "./farmer-profiles.service";
import { CreateFarmerProfileDto } from "./dto/create-farmer-profile.dto";
import { UpdateFarmerProfileDto } from "./dto/update-farmer-profile.dto";
import { JwtGuard } from "@/common/guard/jwt.guard";
import { RolesGuard } from "@/common/guard/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Role } from "@/common/enums/role.enum";
import { AuthUser } from "@/common/interfaces/auth-user.interface";

@ApiTags("farmer-profiles")
@ApiBearerAuth()
@Controller("farmer-profiles")
export class FarmerProfilesController {
  constructor(
    private readonly farmerProfilesService: FarmerProfilesService,
  ) {}

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.GROWER)
  @ApiOperation({ summary: "Create farmer profile (GROWER only)" })
  @ApiResponse({ status: 201, description: "Farmer profile created successfully" })
  @ApiResponse({ status: 400, description: "Bad Request - invalid field values" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 403, description: "Forbidden - user is not a GROWER" })
  @ApiResponse({ status: 409, description: "Conflict - farmer profile already exists" })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() createDto: CreateFarmerProfileDto,
  ) {
    return this.farmerProfilesService.create(user.id, user.role, createDto);
  }

  @Get("me")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.GROWER)
  @ApiOperation({ summary: "Get own farmer profile (GROWER only)" })
  @ApiResponse({ status: 200, description: "Farmer profile retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 403, description: "Forbidden - user is not a GROWER" })
  @ApiResponse({ status: 404, description: "Not Found - farmer profile not created yet" })
  async getOwnProfile(@CurrentUser() user: AuthUser) {
    return this.farmerProfilesService.getOwnProfile(user.id);
  }

  @Get(":id")
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: "Get farmer profile by ID (Any authenticated user)" })
  @ApiResponse({ status: 200, description: "Farmer profile retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 404, description: "Not Found - farmer profile not found" })
  async getById(@Param("id", ParseIntPipe) id: number) {
    return this.farmerProfilesService.findById(id);
  }

  @Patch("me")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.GROWER)
  @ApiOperation({ summary: "Update own farmer profile (GROWER only)" })
  @ApiResponse({ status: 200, description: "Farmer profile updated successfully" })
  @ApiResponse({ status: 400, description: "Bad Request - invalid field values" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 403, description: "Forbidden - user is not a GROWER" })
  @ApiResponse({ status: 404, description: "Not Found - farmer profile not created yet" })
  async updateOwnProfile(
    @CurrentUser() user: AuthUser,
    @Body() updateDto: UpdateFarmerProfileDto,
  ) {
    return this.farmerProfilesService.updateOwnProfile(user.id, updateDto);
  }
}
