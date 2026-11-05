import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateFarmerProfileDto {
  @ApiProperty({
    description: "Name of the tea garden or farm",
    example: "Rahim Tea Garden",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  gardenName!: string;

  @ApiProperty({
    description: "Administrative division",
    example: "Rangpur",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  division!: string;

  @ApiProperty({
    description: "District name",
    example: "Panchagarh",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  district!: string;

  @ApiProperty({
    description: "Sub-district or Upazila/Thana",
    example: "Tetulia",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  upazila!: string;

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
    example: 5.25,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  farmSizeAcres?: number;

  @ApiPropertyOptional({
    description: "Brief description of the tea garden",
    example: "Small organic tea garden established in 2015.",
  })
  @IsOptional()
  @IsString()
  description?: string;
}
