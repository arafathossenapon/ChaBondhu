import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export enum OfferSortField {
  Price = "pricePerKg",
  Expiry = "validUntil",
  MinimumQuantity = "minimumQuantityKg",
  CreatedAt = "createdAt",
}

export enum OfferSortOrder {
  Ascending = "ASC",
  Descending = "DESC",
}

function parsePrice({ value }: TransformFnParams): unknown {
  return typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value)
    ? Number(value)
    : value;
}

function parseInteger({ value }: TransformFnParams): unknown {
  return typeof value === "string" && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class QueryPriceOffersDto {
  @ApiPropertyOptional({
    description: "Exact tea grade, ignoring case",
    example: "CTC",
    maxLength: 100,
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 100)
  teaGrade?: string;

  @ApiPropertyOptional({
    description: "Inclusive minimum price in BDT per kg",
    minimum: 0,
  })
  @Transform(parsePrice)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  minPrice?: number;

  @ApiPropertyOptional({
    description: "Inclusive maximum price in BDT per kg",
    minimum: 0,
  })
  @Transform(parsePrice)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: OfferSortField, default: OfferSortField.Price })
  @IsEnum(OfferSortField)
  sortBy: OfferSortField = OfferSortField.Price;

  @ApiPropertyOptional({
    enum: OfferSortOrder,
    default: OfferSortOrder.Descending,
    description:
      "Use ASC with createdAt for oldest first or DESC for newest first",
  })
  @IsEnum(OfferSortOrder)
  sortOrder: OfferSortOrder = OfferSortOrder.Descending;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Transform(parseInteger)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Transform(parseInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
