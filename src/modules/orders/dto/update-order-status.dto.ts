import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import { IsDecimalNumber } from "@/common/validations/is-decimal-number.decorator";
import { OrderStatus } from "../order-status";

const allowedActions = [
  OrderStatus.CANCELLED,
  OrderStatus.PICKUP_SCHEDULED,
  OrderStatus.COLLECTED,
  OrderStatus.COMPLETED,
] as const;
type OrderAction = (typeof allowedActions)[number];

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: allowedActions })
  @IsIn(allowedActions)
  orderStatus!: OrderAction;

  @ApiPropertyOptional({
    description: "Required for PICKUP_SCHEDULED",
    format: "date",
    example: "2026-12-18",
  })
  @ValidateIf(
    (dto: UpdateOrderStatusDto, value: unknown) =>
      dto.orderStatus === OrderStatus.PICKUP_SCHEDULED || value !== undefined,
  )
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  proposedCollectionDate?: string;

  @ApiPropertyOptional({
    description: "Required for PICKUP_SCHEDULED",
    maxLength: 255,
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @ValidateIf(
    (dto: UpdateOrderStatusDto, value: unknown) =>
      dto.orderStatus === OrderStatus.PICKUP_SCHEDULED || value !== undefined,
  )
  @IsString()
  @Length(1, 255)
  collectionPoint?: string;

  @ApiPropertyOptional({
    description: "Optional logistics notes for PICKUP_SCHEDULED",
  })
  @IsOptional()
  @IsString()
  pickupNotes?: string | null;

  @ApiPropertyOptional({
    description: "Flat transport estimate in BDT for PICKUP_SCHEDULED",
    minimum: 0,
  })
  @IsOptional()
  @IsDecimalNumber(2)
  @Min(0)
  @Max(9999999999.99)
  estimatedTransportCostBdt?: number | null;

  @ApiPropertyOptional({
    description: "Actual kg, required for COLLECTED",
    minimum: 0.001,
    example: 142.75,
  })
  @ValidateIf(
    (dto: UpdateOrderStatusDto, value: unknown) =>
      dto.orderStatus === OrderStatus.COLLECTED || value !== undefined,
  )
  @IsDecimalNumber(3)
  @Min(0.001)
  @Max(9999999.999)
  actualCollectedWeightKg?: number;
}
