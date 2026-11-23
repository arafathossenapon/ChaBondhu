import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Order } from "@/modules/orders/entities/order.entity";

@Entity("payments")
@Unique("UQ_payments_order", ["orderId"])
@Check("CHK_payments_amount", "amount_bdt >= 0.01")
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", update: false })
  orderId!: number;

  @OneToOne(() => Order, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "order_id",
    foreignKeyConstraintName: "FK_payments_order",
  })
  order?: Order;

  @Column({ type: "numeric", precision: 19, scale: 2, update: false })
  amountBdt!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
