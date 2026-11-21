import { ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { OfferStatus } from "@/common/enums/offer-status.enum";
import { QueryPriceOffersDto } from "./query-price-offers.dto";

export class QueryOwnPriceOffersDto extends PickType(QueryPriceOffersDto, [
  "page",
  "limit",
] as const) {
  @ApiPropertyOptional({
    enum: OfferStatus,
    description: "Filter by stored offer status",
  })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}
