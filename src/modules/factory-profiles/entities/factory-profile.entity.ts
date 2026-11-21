import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "@/modules/users/entities/user.entity";
import { FactoryVerificationStatus } from "@/common/enums/factory-verification-status.enum";

@Entity("factory_profiles")
@Check(
  "CHK_factory_verification_status",
  "verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')",
)
export class FactoryProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "integer", unique: true })
  userId!: number;

  @OneToOne(() => User, (user) => user.factoryProfile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column({ type: "varchar", length: 200 })
  factoryName!: string;

  @Column({ type: "varchar", length: 150 })
  representativeName!: string;

  @Index()
  @Column({ type: "varchar", length: 100 })
  district!: string;

  @Column({ type: "varchar", length: 100 })
  upazila!: string;

  @Column({ type: "text", nullable: true })
  address?: string | null;

  @Index("IDX_factory_verification_status")
  @Column({
    type: "varchar",
    length: 20,
    default: FactoryVerificationStatus.PENDING,
  })
  verificationStatus!: FactoryVerificationStatus;

  get isVerified(): boolean {
    return this.verificationStatus === FactoryVerificationStatus.VERIFIED;
  }

  toJSON() {
    return { ...this, isVerified: this.isVerified };
  }

  @Column({ type: "timestamptz", nullable: true })
  verifiedAt?: Date | null;

  @Column({ type: "integer", nullable: true })
  verifiedByAdminId?: number | null;

  @ManyToOne(() => User, (user) => user.verifiedFactories, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "verified_by_admin_id" })
  verifiedByAdmin?: User | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
