import { PartialType, PickType } from "@nestjs/swagger";
import { CreatePriceOfferDto } from "./create-price-offer.dto";

export class UpdatePriceOfferDto extends PartialType(
  PickType(CreatePriceOfferDto, [
    "pricePerKg",
    "minimumQuantityKg",
    "validUntil",
    "notes",
  ] as const),
  { skipNullProperties: false },
) {}
