import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({
    description: "Registered email address",
    example: "rahim@example.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "Account password",
    example: "SecurePass123",
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
