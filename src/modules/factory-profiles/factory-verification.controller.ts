import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { RejectFactoryVerificationDto } from "./dto/reject-factory-verification.dto";
import { FactoryVerificationService } from "./factory-verification.service";

@ApiTags("admin")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin role required" })
@ApiResponse({ status: 404, description: "Factory profile not found" })
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("admin/users")
export class FactoryVerificationController {
  constructor(private readonly verification: FactoryVerificationService) {}

  @Get(":id/factory-verification")
  @ApiOperation({
    summary: "Review a factory profile and its verification history by user ID",
  })
  getReview(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.verification.getAdminReview(actor, id);
  }

  @Patch(":id/verify")
  @ApiOperation({ summary: "Approve pending factory verification by user ID" })
  @ApiResponse({ status: 409, description: "Verification is not pending" })
  async approve(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const factoryProfile = await this.verification.approve(actor, id);
    return { message: "Factory account has been verified.", factoryProfile };
  }

  @Patch(":id/reject-verification")
  @ApiOperation({ summary: "Reject pending factory verification by user ID" })
  @ApiResponse({ status: 400, description: "Invalid rejection reason" })
  @ApiResponse({ status: 409, description: "Verification is not pending" })
  async reject(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RejectFactoryVerificationDto,
  ) {
    const factoryProfile = await this.verification.reject(
      actor,
      id,
      dto.reason,
    );
    return {
      message: "Factory verification has been rejected.",
      factoryProfile,
    };
  }
}
