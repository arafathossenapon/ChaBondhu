import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

export class CreateOrderRequestDto {
  @ApiProperty({ example: 12, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  harvestListingId!: number;

  @ApiProperty({ example: 5, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  priceOfferId!: number;
}
