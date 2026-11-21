import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { OfferStatus } from "@/common/enums/offer-status.enum";
import { FactoryProfile } from "@/modules/factory-profiles/entities/factory-profile.entity";

const numeric = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity("price_offers")
@Check("CHK_price_offer_price", "price_per_kg > 0")
@Check("CHK_price_offer_minimum_quantity", "minimum_quantity_kg > 0")
@Check("CHK_price_offer_transport_cost", "estimated_transport_cost_bdt >= 0")
@Check("CHK_price_offer_status", "status IN ('ACTIVE', 'EXPIRED', 'WITHDRAWN')")
@Index("IDX_price_offer_status_valid_until", ["status", "validUntil"])
export class PriceOffer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index("IDX_price_offer_factory_profile")
  @Column({ type: "integer" })
  factoryProfileId!: number;

  @ManyToOne(() => FactoryProfile, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "factory_profile_id",
    foreignKeyConstraintName: "FK_price_offer_factory_profile",
  })
  factoryProfile?: FactoryProfile;

  @Index("IDX_price_offer_tea_grade")
  @Column({ type: "varchar", length: 100 })
  teaGrade!: string;

  @Column({ type: "numeric", precision: 12, scale: 2, transformer: numeric })
  pricePerKg!: number;

  @Column({ type: "text", nullable: true })
  qualityRequirements!: string | null;

  @Column({
    type: "numeric",
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: numeric,
  })
  minimumQuantityKg!: number | null;

  @Column({ type: "date" })
  validUntil!: string;

  @Column({
    type: "numeric",
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numeric,
  })
  estimatedTransportCostBdt!: number | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "varchar", length: 20, default: OfferStatus.ACTIVE })
  status!: OfferStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
