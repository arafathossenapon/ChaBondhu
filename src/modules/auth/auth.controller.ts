import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register a new GROWER or FACTORY user account" })
  @ApiResponse({ status: 201, description: "User successfully registered" })
  @ApiResponse({ status: 400, description: "Validation failed or bad input" })
  @ApiResponse({ status: 409, description: "Email is already registered" })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Authenticate a user and receive a JWT token" })
  @ApiResponse({
    status: 200,
    description: "Login successful, returns JWT and user profile",
  })
  @ApiResponse({ status: 400, description: "Validation failed" })
  @ApiResponse({ status: 401, description: "Incorrect email or password" })
  @ApiResponse({ status: 403, description: "Account is deactivated" })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
