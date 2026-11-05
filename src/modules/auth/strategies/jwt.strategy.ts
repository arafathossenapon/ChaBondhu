import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "@/modules/users/users.service";
import { AuthUser } from "@/common/interfaces/auth-user.interface";

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>("JWT_BEARER_SECRET") ||
        process.env.JWT_BEARER_SECRET ||
        "chabondhu_dev_secret_key_change_in_production",
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        "User is not authorized or account is inactive",
      );
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      roles: [user.role],
    };
  }
}
