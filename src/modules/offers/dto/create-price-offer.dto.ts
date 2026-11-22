import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import { IsDecimalNumber } from "@/common/validations/is-decimal-number.decorator";

export class CreatePriceOfferDto {
  @ApiProperty({ example: "CTC", minLength: 1, maxLength: 100 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  teaGrade!: string;

  @ApiProperty({
    description: "Buying price in BDT per kg",
    example: 28.5,
    minimum: 0.01,
  })
  @IsDecimalNumber(2)
  @Min(0.01)
  @Max(9999999999.99)
  pricePerKg!: number;

  @ApiPropertyOptional({ description: "Free-text quality criteria" })
  @IsOptional()
  @IsString()
  qualityRequirements?: string | null;

  @ApiPropertyOptional({
    description: "Minimum accepted batch in kg",
    example: 100,
    minimum: 0.001,
  })
  @IsOptional()
  @IsDecimalNumber(3)
  @Min(0.001)
  @Max(9999999.999)
  minimumQuantityKg?: number | null;

  @ApiProperty({
    description: "Expiry date after today in Bangladesh",
    format: "date",
    example: "2099-12-31",
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  validUntil!: string;

  @ApiPropertyOptional({
    description: "Flat transport estimate in BDT",
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @IsDecimalNumber(2)
  @Min(0)
  @Max(9999999999.99)
  estimatedTransportCostBdt?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}
