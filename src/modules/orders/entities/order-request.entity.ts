import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { HarvestListing } from "@/modules/listings/entities/harvest-listing.entity";
import { PriceOffer } from "@/modules/offers/entities/price-offer.entity";
import { OrderRequestClosureReason, OrderRequestStatus } from "../order-status";

@Entity("order_requests")
@Unique("UQ_order_requests_id_listing", ["id", "harvestListingId"])
@Index("IDX_order_requests_listing_status", ["harvestListingId", "status"])
@Index("IDX_order_requests_offer", ["priceOfferId"])
@Index(
  "UQ_order_requests_pending_listing_offer",
  ["harvestListingId", "priceOfferId"],
  {
    unique: true,
    where: "status = 'PENDING'",
  },
)
@Check("CHK_order_requests_price", "quoted_price_per_kg > 0")
@Check(
  "CHK_order_requests_status",
  "status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CLOSED', 'WITHDRAWN')",
)
@Check(
  "CHK_order_requests_closure",
  "(status = 'CLOSED' AND closure_reason IS NOT NULL AND closure_reason IN ('ANOTHER_REQUEST_ACCEPTED', 'LISTING_UNAVAILABLE')) OR (status <> 'CLOSED' AND closure_reason IS NULL)",
)
export class OrderRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", update: false })
  harvestListingId!: number;

  @ManyToOne(() => HarvestListing, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "harvest_listing_id",
    foreignKeyConstraintName: "FK_order_requests_listing",
  })
  harvestListing?: HarvestListing;

  @Column({ type: "integer", update: false })
  priceOfferId!: number;

  @ManyToOne(() => PriceOffer, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "price_offer_id",
    foreignKeyConstraintName: "FK_order_requests_offer",
  })
  priceOffer?: PriceOffer;

  @Column({
    type: "numeric",
    precision: 12,
    scale: 2,
    update: false,
    transformer: { to: (value: number) => value, from: Number },
  })
  quotedPricePerKg!: number;

  @Column({ type: "varchar", length: 20, default: OrderRequestStatus.PENDING })
  status!: OrderRequestStatus;

  @Column({ type: "varchar", length: 30, nullable: true })
  closureReason!: OrderRequestClosureReason | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
