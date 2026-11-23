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
} from "typeorm";
import { User } from "@/modules/users/entities/user.entity";
import { Payment } from "./payment.entity";

export enum PaymentMethod {
  CASH = "CASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  MOBILE_FINANCIAL_SERVICE = "MOBILE_FINANCIAL_SERVICE",
}

export enum ReceiptDecision {
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
}

@Entity("payment_attempts")
@Unique("UQ_payment_attempt_key", ["paymentId", "idempotencyKey"])
@Index("UQ_payment_attempt_open", ["paymentId"], {
  unique: true,
  where: "decision IS NULL",
})
@Index("UQ_payment_attempt_confirmed", ["paymentId"], {
  unique: true,
  where: "decision = 'CONFIRMED'",
})
@Index("UQ_payment_attempt_reference", ["method", "provider", "reference"], {
  unique: true,
  where: "method <> 'CASH'",
})
export class PaymentAttempt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", update: false })
  paymentId!: number;

  @ManyToOne(() => Payment, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "payment_id",
    foreignKeyConstraintName: "FK_payment_attempt_payment",
  })
  payment?: Payment;

  @Column({ type: "integer", update: false })
  submittedBy!: number;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "submitted_by",
    foreignKeyConstraintName: "FK_payment_attempt_submitter",
  })
  submitter?: User;

  @Column({ type: "varchar", length: 128, update: false, select: false })
  idempotencyKey!: string;

  @Column({ type: "varchar", length: 32, update: false })
  method!: PaymentMethod;

  @Column({ type: "varchar", length: 120, nullable: true, update: false })
  provider!: string | null;

  @Column({ type: "varchar", length: 160, nullable: true, update: false })
  reference!: string | null;

  @Column({ type: "date", update: false })
  paymentDate!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "varchar", length: 12, nullable: true })
  decision!: ReceiptDecision | null;

  @Column({ type: "integer", nullable: true })
  decidedBy!: number | null;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "decided_by",
    foreignKeyConstraintName: "FK_payment_attempt_reviewer",
  })
  reviewer?: User;

  @Column({ type: "timestamptz", nullable: true })
  decidedAt!: Date | null;

  @Column({ type: "varchar", length: 1000, nullable: true })
  rejectionReason!: string | null;
}
