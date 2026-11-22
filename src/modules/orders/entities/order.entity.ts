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
import { OrderStatus, PaymentStatus } from "../order-status";
import { OrderRequest } from "./order-request.entity";

const numeric = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity("orders")
@Unique("UQ_orders_request", ["orderRequestId"])
@Index("IDX_orders_listing", ["harvestListingId"])
@Index("UQ_orders_listing_reservation", ["harvestListingId"], {
  unique: true,
  where:
    "order_status IN ('ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'COMPLETED')",
})
@Check("CHK_orders_price", "agreed_price_per_kg > 0")
@Check("CHK_orders_estimated_quantity", "estimated_quantity_kg > 0")
@Check("CHK_orders_actual_weight", "actual_collected_weight_kg >= 0")
@Check("CHK_orders_transport_cost", "estimated_transport_cost_bdt >= 0")
@Check(
  "CHK_orders_pickup_fields",
  "order_status NOT IN ('PICKUP_SCHEDULED', 'COLLECTED', 'COMPLETED') OR (proposed_collection_date IS NOT NULL AND collection_point IS NOT NULL AND length(btrim(collection_point)) > 0)",
)
@Check(
  "CHK_orders_collected_weight",
  "(order_status IN ('COLLECTED', 'COMPLETED')) = (actual_collected_weight_kg IS NOT NULL)",
)
@Check(
  "CHK_orders_order_status",
  "order_status IN ('ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'COMPLETED', 'CANCELLED')",
)
@Check(
  "CHK_orders_payment_status",
  "payment_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')",
)
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", update: false })
  orderRequestId!: number;

  @Column({ type: "integer", update: false })
  harvestListingId!: number;

  @ManyToOne(() => OrderRequest, { onDelete: "RESTRICT" })
  @JoinColumn([
    {
      name: "order_request_id",
      referencedColumnName: "id",
      foreignKeyConstraintName: "FK_orders_request_listing",
    },
    { name: "harvest_listing_id", referencedColumnName: "harvestListingId" },
  ])
  orderRequest?: OrderRequest;

  @Column({
    type: "numeric",
    precision: 12,
    scale: 2,
    transformer: numeric,
    update: false,
  })
  agreedPricePerKg!: number;

  @Column({
    type: "numeric",
    precision: 10,
    scale: 3,
    transformer: numeric,
    update: false,
  })
  estimatedQuantityKg!: number;

  @Column({
    type: "numeric",
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: numeric,
  })
  actualCollectedWeightKg!: number | null;

  @Column({ type: "date", nullable: true })
  proposedCollectionDate!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  collectionPoint!: string | null;

  @Column({ type: "text", nullable: true })
  pickupNotes!: string | null;

  @Column({
    type: "numeric",
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numeric,
  })
  estimatedTransportCostBdt!: number | null;

  @Column({ type: "varchar", length: 30, default: OrderStatus.ACCEPTED })
  orderStatus!: OrderStatus;

  @Column({ type: "varchar", length: 20, default: PaymentStatus.PENDING })
  paymentStatus!: PaymentStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
