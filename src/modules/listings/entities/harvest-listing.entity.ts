import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Check,
} from "typeorm";
import { FarmerProfile } from "@/modules/farmer-profiles/entities/farmer-profile.entity";
import { ListingStatus } from "@/common/enums/listing-status.enum";

@Entity("harvest_listings")
@Check('"estimated_quantity_kg" > 0')
@Index(["status", "isActive"])
export class HarvestListing {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "integer", name: "farmer_profile_id" })
  farmerProfileId!: number;

  @ManyToOne(() => FarmerProfile, (farmer) => farmer.harvestListings, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "farmer_profile_id" })
  farmerProfile?: FarmerProfile;

  @Index()
  @Column({ type: "varchar", length: 100 })
  teaGrade!: string;

  @Column({
    type: "numeric",
    precision: 10,
    scale: 3,
    transformer: {
      to: (val?: number | null) => val,
      from: (val: string | null) => (val === null ? null : parseFloat(val)),
    },
  })
  estimatedQuantityKg!: number;

  @Column({ type: "date" })
  expectedHarvestDate!: Date | string;

  @Column({ type: "date", nullable: true })
  lastHarvestDate?: Date | string | null;

  @Column({ type: "text", nullable: true })
  qualityDescription?: string | null;

  @Column({ type: "varchar", length: 255 })
  collectionLocation!: string;

  @Index()
  @Column({
    type: "varchar",
    length: 20,
    default: ListingStatus.ACTIVE,
  })
  status!: ListingStatus;

  @Column({ type: "text", nullable: true })
  notes?: string | null;

  @Index()
  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
