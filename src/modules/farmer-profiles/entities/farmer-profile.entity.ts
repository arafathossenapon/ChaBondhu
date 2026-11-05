import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "@/modules/users/entities/user.entity";
import { HarvestListing } from "@/modules/listings/entities/harvest-listing.entity";

@Entity("farmer_profiles")
export class FarmerProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "integer", unique: true })
  userId!: number;

  @OneToOne(() => User, (user) => user.farmerProfile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @OneToMany(() => HarvestListing, (listing) => listing.farmerProfile)
  harvestListings?: HarvestListing[];

  @Column({ type: "varchar", length: 200 })
  gardenName!: string;

  @Column({ type: "varchar", length: 100 })
  division!: string;

  @Index()
  @Column({ type: "varchar", length: 100 })
  district!: string;

  @Column({ type: "varchar", length: 100 })
  upazila!: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  village?: string | null;

  @Column({
    type: "numeric",
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: {
      to: (val?: number | null) => val,
      from: (val: string | null) => (val === null ? null : parseFloat(val)),
    },
  })
  farmSizeAcres?: number | null;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
