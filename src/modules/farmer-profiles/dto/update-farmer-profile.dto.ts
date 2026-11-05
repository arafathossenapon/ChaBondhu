import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateFarmerProfileDto {
  @ApiPropertyOptional({
    description: "Name of the tea garden or farm",
    example: "Rahim Premium Tea Garden",
  })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  gardenName?: string;

  @ApiPropertyOptional({
    description: "Administrative division",
    example: "Rangpur",
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  division?: string;

  @ApiPropertyOptional({
    description: "District name",
    example: "Panchagarh",
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  district?: string;

  @ApiPropertyOptional({
    description: "Sub-district or Upazila/Thana",
    example: "Tetulia",
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  upazila?: string;

  @ApiPropertyOptional({
    description: "Village or local area name",
    example: "Bhajanghat",
  })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  village?: string;

  @ApiPropertyOptional({
    description: "Farm size in acres (informational only)",
    example: 6.0,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  farmSizeAcres?: number;

  @ApiPropertyOptional({
    description: "Brief description of the tea garden",
    example: "Updated garden description.",
  })
  @IsOptional()
  @IsString()
  description?: string;
}
