import { NotFoundException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { HarvestListing } from "./entities/harvest-listing.entity";

export async function lockHarvestListing(
  manager: EntityManager,
  id: number,
): Promise<HarvestListing> {
  if (id < 1 || id > 2147483647)
    throw new NotFoundException("Harvest listing not found");
  const listing = await manager.findOne(HarvestListing, {
    where: { id },
    lock: { mode: "pessimistic_write" },
  });
  if (!listing) throw new NotFoundException("Harvest listing not found");
  return listing;
}
