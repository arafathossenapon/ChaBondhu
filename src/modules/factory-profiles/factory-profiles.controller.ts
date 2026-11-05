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
import { FactoryProfilesService } from "./factory-profiles.service";
import { CreateFactoryProfileDto } from "./dto/create-factory-profile.dto";
import { UpdateFactoryProfileDto } from "./dto/update-factory-profile.dto";
import { JwtGuard } from "@/common/guard/jwt.guard";
import { RolesGuard } from "@/common/guard/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Role } from "@/common/enums/role.enum";
import { AuthUser } from "@/common/interfaces/auth-user.interface";

@ApiTags("factory-profiles")
@ApiBearerAuth()
@Controller("factory-profiles")
export class FactoryProfilesController {
  constructor(
    private readonly factoryProfilesService: FactoryProfilesService,
  ) {}

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.FACTORY)
  @ApiOperation({ summary: "Create factory profile (FACTORY only)" })
  @ApiResponse({ status: 201, description: "Factory profile created successfully" })
  @ApiResponse({ status: 400, description: "Bad Request - invalid field values" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 403, description: "Forbidden - user is not a FACTORY" })
  @ApiResponse({ status: 409, description: "Conflict - factory profile already exists" })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() createDto: CreateFactoryProfileDto,
  ) {
    return this.factoryProfilesService.create(user.id, user.role, createDto);
  }

  @Get("me")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.FACTORY)
  @ApiOperation({ summary: "Get own factory profile (FACTORY only)" })
  @ApiResponse({ status: 200, description: "Factory profile retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 403, description: "Forbidden - user is not a FACTORY" })
  @ApiResponse({ status: 404, description: "Not Found - factory profile not created yet" })
  async getOwnProfile(@CurrentUser() user: AuthUser) {
    return this.factoryProfilesService.getOwnProfile(user.id);
  }

  @Get(":id")
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: "Get factory profile by ID (Any authenticated user)" })
  @ApiResponse({ status: 200, description: "Factory profile retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 404, description: "Not Found - factory profile not found" })
  async getById(@Param("id", ParseIntPipe) id: number) {
    return this.factoryProfilesService.findById(id);
  }

  @Patch("me")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.FACTORY)
  @ApiOperation({ summary: "Update own factory profile (FACTORY only)" })
  @ApiResponse({ status: 200, description: "Factory profile updated successfully" })
  @ApiResponse({ status: 400, description: "Bad Request - invalid field values" })
  @ApiResponse({ status: 401, description: "Unauthorized - missing or invalid token" })
  @ApiResponse({ status: 403, description: "Forbidden - user is not a FACTORY" })
  @ApiResponse({ status: 404, description: "Not Found - factory profile not created yet" })
  async updateOwnProfile(
    @CurrentUser() user: AuthUser,
    @Body() updateDto: UpdateFactoryProfileDto,
  ) {
    return this.factoryProfilesService.updateOwnProfile(user.id, updateDto);
  }
}
