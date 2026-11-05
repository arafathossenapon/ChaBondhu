import { IsOptional, IsString, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class QueryHarvestListingDto {
  @ApiPropertyOptional({
    description: "Filter listings by tea grade (partial or exact match)",
    example: "CTC",
  })
  @IsOptional()
  @IsString()
  teaGrade?: string;

  @ApiPropertyOptional({
    description: "Filter listings by farmer's district",
    example: "Panchagarh",
  })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({
    description: "Page number (default: 1)",
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Items per page (default: 20, max: 100)",
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
