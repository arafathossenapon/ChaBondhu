import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtGuard } from "@/common/guard/jwt.guard";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { AuthUser } from "@/common/interfaces/auth-user.interface";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Get authenticated user's own profile" })
  @ApiResponse({
    status: 200,
    description: "Profile retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT",
  })
  async getProfile(@CurrentUser() currentUser: AuthUser) {
    return this.usersService.getProfile(currentUser.id);
  }

  @Patch("me")
  @ApiOperation({ summary: "Update authenticated user's own profile" })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - invalid field values",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT",
  })
  async updateProfile(
    @CurrentUser() currentUser: AuthUser,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(currentUser.id, updateUserDto);
  }
}
