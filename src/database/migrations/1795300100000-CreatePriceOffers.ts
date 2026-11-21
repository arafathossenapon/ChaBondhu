import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePriceOffers1795300100000 implements MigrationInterface {
  name = "CreatePriceOffers1795300100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE price_offers (
      id serial PRIMARY KEY,
      factory_profile_id integer NOT NULL,
      tea_grade varchar(100) NOT NULL,
      price_per_kg numeric(12, 2) NOT NULL,
      quality_requirements text,
      minimum_quantity_kg numeric(10, 3),
      valid_until date NOT NULL,
      estimated_transport_cost_bdt numeric(12, 2),
      notes text,
      status varchar(20) NOT NULL DEFAULT 'ACTIVE',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_price_offer_factory_profile" FOREIGN KEY (factory_profile_id)
        REFERENCES factory_profiles(id) ON DELETE RESTRICT,
      CONSTRAINT "CHK_price_offer_price" CHECK (price_per_kg > 0),
      CONSTRAINT "CHK_price_offer_minimum_quantity" CHECK (minimum_quantity_kg > 0),
      CONSTRAINT "CHK_price_offer_transport_cost" CHECK (estimated_transport_cost_bdt >= 0),
      CONSTRAINT "CHK_price_offer_status" CHECK (status IN ('ACTIVE', 'EXPIRED', 'WITHDRAWN'))
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_price_offer_factory_profile" ON price_offers (factory_profile_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_price_offer_tea_grade" ON price_offers (tea_grade)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_price_offer_status_valid_until" ON price_offers (status, valid_until)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE price_offers");
  }
}
