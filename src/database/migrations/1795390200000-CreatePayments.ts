import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePayments1795390200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE");
    const legacy = await queryRunner.query(
      "SELECT DISTINCT payment_status FROM orders WHERE payment_status <> 'PENDING'",
    );
    if (legacy.length) {
      throw new Error(
        "Existing non-PENDING payment statuses require a reviewed mapping",
      );
    }
    await queryRunner.query(`
      ALTER TABLE orders DROP CONSTRAINT "CHK_orders_payment_status",
        ADD CONSTRAINT "CHK_orders_payment_status" CHECK (
          payment_status IN ('PENDING', 'SUBMITTED', 'CONFIRMED', 'REJECTED')
        );
      CREATE TABLE payments (
        id SERIAL PRIMARY KEY,
        order_id integer NOT NULL,
        amount_bdt numeric(19,2) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payments_order" UNIQUE (order_id),
        CONSTRAINT "FK_payments_order" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
        CONSTRAINT "CHK_payments_amount" CHECK (amount_bdt >= 0.01)
      );
      CREATE TABLE payment_attempts (
        id SERIAL PRIMARY KEY,
        payment_id integer NOT NULL,
        submitted_by integer NOT NULL,
        idempotency_key varchar(128) NOT NULL,
        method varchar(32) NOT NULL,
        provider varchar(120),
        reference varchar(160),
        payment_date date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        decision varchar(12),
        decided_by integer,
        decided_at timestamptz,
        rejection_reason varchar(1000),
        CONSTRAINT "FK_payment_attempt_payment" FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT,
        CONSTRAINT "FK_payment_attempt_submitter" FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT "FK_payment_attempt_reviewer" FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT "UQ_payment_attempt_key" UNIQUE (payment_id, idempotency_key),
        CONSTRAINT "CHK_payment_attempt_method" CHECK (
          (method = 'CASH' AND provider IS NULL)
          OR (method = 'BANK_TRANSFER' AND provider IS NOT NULL AND length(btrim(provider)) > 0
              AND reference IS NOT NULL AND length(btrim(reference)) > 0)
          OR (method = 'MOBILE_FINANCIAL_SERVICE' AND provider IS NOT NULL AND provider IN ('BKASH', 'NAGAD')
              AND reference IS NOT NULL AND length(btrim(reference)) > 0)
        ),
        CONSTRAINT "CHK_payment_attempt_decision" CHECK (
          (decision IS NULL AND decided_by IS NULL AND decided_at IS NULL AND rejection_reason IS NULL)
          OR (decision IS NOT NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND (
            (decision = 'CONFIRMED' AND rejection_reason IS NULL)
            OR (decision = 'REJECTED' AND rejection_reason IS NOT NULL AND length(btrim(rejection_reason)) > 0)
          ))
        )
      );
      CREATE UNIQUE INDEX "UQ_payment_attempt_open" ON payment_attempts(payment_id) WHERE decision IS NULL;
      CREATE UNIQUE INDEX "UQ_payment_attempt_confirmed" ON payment_attempts(payment_id) WHERE decision = 'CONFIRMED';
      CREATE UNIQUE INDEX "UQ_payment_attempt_reference" ON payment_attempts(method, provider, reference) WHERE method <> 'CASH';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE");
    await queryRunner.query("LOCK TABLE payments IN ACCESS EXCLUSIVE MODE");
    if ((await queryRunner.query("SELECT 1 FROM payments LIMIT 1")).length) {
      throw new Error(
        "Payment history exists and cannot be removed by rollback",
      );
    }
    await queryRunner.query(`
      DROP TABLE payment_attempts;
      DROP TABLE payments;
      ALTER TABLE orders DROP CONSTRAINT "CHK_orders_payment_status",
        ADD CONSTRAINT "CHK_orders_payment_status" CHECK (
          payment_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')
        );
    `);
  }
}
