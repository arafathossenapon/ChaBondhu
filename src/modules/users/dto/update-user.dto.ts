import { IsOptional, IsString, Length } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: "User's full name",
    example: "Rahim Uddin",
  })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  fullName?: string;

  @ApiPropertyOptional({
    description: "Contact phone number",
    example: "01711000001",
  })
  @IsOptional()
  @IsString()
  @Length(6, 20)
  phoneNumber?: string;
}
