import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsPositive,
  IsISO8601,
  Length,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateHarvestListingDto {
  @ApiProperty({
    description: "Free-text tea grade or type (e.g., 'Green', 'CTC', 'First Flush')",
    example: "CTC",
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  teaGrade!: string;

  @ApiProperty({
    description: "Farmer's quantity estimate in kilograms (must be positive)",
    example: 350.5,
  })
  @IsNumber()
  @IsPositive()
  estimatedQuantityKg!: number;

  @ApiProperty({
    description: "Expected harvest date in ISO date format (YYYY-MM-DD)",
    example: "2026-12-15",
  })
  @IsNotEmpty()
  @IsISO8601({ strict: true })
  expectedHarvestDate!: string;

  @ApiPropertyOptional({
    description: "Optional date of last harvest in ISO date format (YYYY-MM-DD)",
    example: "2026-09-20",
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  lastHarvestDate?: string;

  @ApiPropertyOptional({
    description: "Optional description of leaf quality or harvest condition",
    example: "First flush, medium leaf, clean.",
  })
  @IsOptional()
  @IsString()
  qualityDescription?: string;

  @ApiProperty({
    description: "Physical location/address where leaves can be collected",
    example: "Bhajanghat village, Tetulia, Panchagarh",
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  collectionLocation!: string;

  @ApiPropertyOptional({
    description: "Optional notes for buyers or collection coordinators",
    example: "Leaves will be ready after 10 AM.",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
