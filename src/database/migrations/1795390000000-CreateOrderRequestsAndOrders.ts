import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrderRequestsAndOrders1795390000000 implements MigrationInterface {
  name = "CreateOrderRequestsAndOrders1795390000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE order_requests (
      id serial PRIMARY KEY,
      harvest_listing_id integer NOT NULL,
      price_offer_id integer NOT NULL,
      quoted_price_per_kg numeric(12, 2) NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'PENDING',
      closure_reason varchar(30),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_order_requests_listing" FOREIGN KEY (harvest_listing_id)
        REFERENCES harvest_listings(id) ON DELETE RESTRICT,
      CONSTRAINT "FK_order_requests_offer" FOREIGN KEY (price_offer_id)
        REFERENCES price_offers(id) ON DELETE RESTRICT,
      CONSTRAINT "UQ_order_requests_id_listing" UNIQUE (id, harvest_listing_id),
      CONSTRAINT "CHK_order_requests_price" CHECK (quoted_price_per_kg > 0),
      CONSTRAINT "CHK_order_requests_status" CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CLOSED', 'WITHDRAWN')),
      CONSTRAINT "CHK_order_requests_closure"
        CHECK ((status = 'CLOSED' AND closure_reason IS NOT NULL AND closure_reason IN ('ANOTHER_REQUEST_ACCEPTED', 'LISTING_UNAVAILABLE'))
          OR (status <> 'CLOSED' AND closure_reason IS NULL))
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_requests_listing_status" ON order_requests (harvest_listing_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_requests_offer" ON order_requests (price_offer_id)`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_order_requests_pending_listing_offer"
      ON order_requests (harvest_listing_id, price_offer_id) WHERE status = 'PENDING'`);
    await queryRunner.query(`CREATE TABLE orders (
      id serial PRIMARY KEY,
      order_request_id integer NOT NULL,
      harvest_listing_id integer NOT NULL,
      agreed_price_per_kg numeric(12, 2) NOT NULL,
      estimated_quantity_kg numeric(10, 3) NOT NULL,
      actual_collected_weight_kg numeric(10, 3),
      order_status varchar(30) NOT NULL DEFAULT 'ACCEPTED',
      payment_status varchar(20) NOT NULL DEFAULT 'PENDING',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_orders_request_listing" FOREIGN KEY (order_request_id, harvest_listing_id)
        REFERENCES order_requests(id, harvest_listing_id) ON DELETE RESTRICT,
      CONSTRAINT "UQ_orders_request" UNIQUE (order_request_id),
      CONSTRAINT "CHK_orders_price" CHECK (agreed_price_per_kg > 0),
      CONSTRAINT "CHK_orders_estimated_quantity" CHECK (estimated_quantity_kg > 0),
      CONSTRAINT "CHK_orders_actual_weight" CHECK (actual_collected_weight_kg >= 0),
      CONSTRAINT "CHK_orders_order_status" CHECK (order_status IN ('ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'COMPLETED', 'CANCELLED')),
      CONSTRAINT "CHK_orders_payment_status" CHECK (payment_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'))
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_listing" ON orders (harvest_listing_id)`,
    );
    // সম্পন্ন অর্ডারও তালিকাটিকে আবার বিক্রি হওয়া থেকে রক্ষা করে।
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_orders_listing_reservation" ON orders (harvest_listing_id)
      WHERE order_status IN ('ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'COMPLETED')`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE orders");
    await queryRunner.query("DROP TABLE order_requests");
    await queryRunner.query(
      "UPDATE harvest_listings SET status = 'ACTIVE' WHERE status = 'RESERVED'",
    );
  }
}
