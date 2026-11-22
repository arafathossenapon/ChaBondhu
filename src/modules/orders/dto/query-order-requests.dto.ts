import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { OrderRequestStatus } from "../order-status";

function parseInteger({ value }: TransformFnParams): unknown {
  return typeof value === "string" && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class OrdersPaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 2147483647 })
  @Transform(parseInteger)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Transform(parseInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class QueryOrderRequestsDto extends OrdersPaginationDto {
  @ApiPropertyOptional({ enum: OrderRequestStatus })
  @IsOptional()
  @IsEnum(OrderRequestStatus)
  status?: OrderRequestStatus;
}
