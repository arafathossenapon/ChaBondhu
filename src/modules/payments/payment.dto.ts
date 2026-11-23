import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  Min,
  Max,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from "class-validator";
import { PaymentMethod } from "./entities/payment-attempt.entity";

export class SubmitPaymentDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ format: "date" })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  paymentDate!: string;

  @ApiPropertyOptional({
    description:
      "Required for bank transfers and mobile payments. Mobile providers are BKASH and NAGAD.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @ValidateIf(
    (dto, value) => dto.method !== PaymentMethod.CASH || value !== undefined,
  )
  @IsString()
  @Length(1, 120)
  provider?: string;

  @ApiPropertyOptional({
    description: "Required for bank transfers and mobile payments.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @ValidateIf(
    (dto, value) => dto.method !== PaymentMethod.CASH || value !== undefined,
  )
  @IsString()
  @Length(1, 160)
  reference?: string;
}

export class RejectPaymentDto {
  @ApiProperty({ maxLength: 1000 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 1000)
  rejectionReason!: string;
}

export class ConfirmPaymentDto {
  // An empty decision body is required; the global validation pipe rejects extra fields.
  @ValidateIf((_, value) => value !== undefined)
  @IsIn([])
  private readonly confirmation?: never;
}

export class QueryPaymentsDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
