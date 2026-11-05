import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@/common/enums/role.enum";

export enum AllowedRegisterRole {
  GROWER = Role.GROWER,
  FACTORY = Role.FACTORY,
}

export class RegisterDto {
  @ApiProperty({
    description: "Full name of the user",
    example: "Rahim Uddin",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  fullName!: string;

  @ApiProperty({
    description: "Unique email address for login",
    example: "rahim@example.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "Password (minimum 8 characters)",
    example: "SecurePass123",
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    description: "Contact phone number",
    example: "01711000001",
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 20)
  phoneNumber!: string;

  @ApiProperty({
    description: "User role on the platform (GROWER or FACTORY only)",
    enum: AllowedRegisterRole,
    example: AllowedRegisterRole.GROWER,
  })
  @IsEnum(AllowedRegisterRole, {
    message: "role must be either GROWER or FACTORY",
  })
  role!: AllowedRegisterRole;
}
