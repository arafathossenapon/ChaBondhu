import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { FactoryVerificationStatus } from "@/common/enums/factory-verification-status.enum";
import { User } from "@/modules/users/entities/user.entity";
import { FactoryProfile } from "./factory-profile.entity";

export type FactoryVerificationDecision =
  | FactoryVerificationStatus.VERIFIED
  | FactoryVerificationStatus.REJECTED;

@Entity("factory_verification_reviews")
@Index("IDX_factory_review_profile_id", ["factoryProfileId", "id"])
@Check(
  "CHK_factory_verification_decision",
  "(decision = 'VERIFIED' AND reason IS NULL) OR (decision = 'REJECTED' AND reason IS NOT NULL AND length(btrim(reason)) > 0)",
)
export class FactoryVerificationReview {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer" })
  factoryProfileId!: number;

  @ManyToOne(() => FactoryProfile, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "factory_profile_id" })
  factoryProfile?: FactoryProfile;

  @Column({ type: "integer", nullable: true })
  reviewedByAdminId!: number | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "reviewed_by_admin_id" })
  reviewedByAdmin?: User | null;

  @Column({ type: "varchar", length: 20 })
  decision!: FactoryVerificationDecision;

  @Column({ type: "varchar", length: 1000, nullable: true })
  reason!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
