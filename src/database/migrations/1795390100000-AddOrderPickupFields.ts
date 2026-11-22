import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderPickupFields1795390100000 implements MigrationInterface {
  name = "AddOrderPickupFields1795390100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders
      ADD COLUMN proposed_collection_date date,
      ADD COLUMN collection_point varchar(255),
      ADD COLUMN pickup_notes text,
      ADD COLUMN estimated_transport_cost_bdt numeric(12, 2),
      ADD CONSTRAINT "CHK_orders_transport_cost" CHECK (estimated_transport_cost_bdt >= 0),
      ADD CONSTRAINT "CHK_orders_pickup_fields" CHECK (
        order_status NOT IN ('PICKUP_SCHEDULED', 'COLLECTED', 'COMPLETED')
        OR (proposed_collection_date IS NOT NULL AND collection_point IS NOT NULL AND length(btrim(collection_point)) > 0)
      ),
      ADD CONSTRAINT "CHK_orders_collected_weight" CHECK (
        (order_status IN ('COLLECTED', 'COMPLETED')) = (actual_collected_weight_kg IS NOT NULL)
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders
      DROP CONSTRAINT "CHK_orders_collected_weight",
      DROP CONSTRAINT "CHK_orders_pickup_fields",
      DROP CONSTRAINT "CHK_orders_transport_cost",
      DROP COLUMN estimated_transport_cost_bdt,
      DROP COLUMN pickup_notes,
      DROP COLUMN collection_point,
      DROP COLUMN proposed_collection_date`);
  }
}
