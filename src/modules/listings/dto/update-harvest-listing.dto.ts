import {
  IsOptional,
  IsString,
  IsNumber,
  IsPositive,
  IsISO8601,
  Length,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateHarvestListingDto {
  @ApiPropertyOptional({
    description: "Free-text tea grade or type",
    example: "CTC Premium",
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  teaGrade?: string;

  @ApiPropertyOptional({
    description: "Updated estimated quantity in kg (must be positive)",
    example: 400.0,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  estimatedQuantityKg?: number;

  @ApiPropertyOptional({
    description: "Expected harvest date in ISO date format (YYYY-MM-DD)",
    example: "2026-12-20",
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  expectedHarvestDate?: string;

  @ApiPropertyOptional({
    description: "Date of last harvest in ISO date format (YYYY-MM-DD)",
    example: "2026-09-25",
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  lastHarvestDate?: string;

  @ApiPropertyOptional({
    description: "Updated quality description",
    example: "Updated quality notes.",
  })
  @IsOptional()
  @IsString()
  qualityDescription?: string;

  @ApiPropertyOptional({
    description: "Updated collection location",
    example: "Updated collection point, Tetulia",
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  collectionLocation?: string;

  @ApiPropertyOptional({
    description: "Updated notes",
    example: "Available after Dec 10.",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
