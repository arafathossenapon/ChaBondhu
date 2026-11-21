import { MigrationInterface, QueryRunner } from "typeorm";

export class TrackFactoryVerificationReviews1795300000000 implements MigrationInterface {
  name = "TrackFactoryVerificationReviews1795300000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE factory_profiles RENAME COLUMN is_verified TO verification_status`,
    );
    await queryRunner.query(`ALTER TABLE factory_profiles
      ALTER COLUMN verification_status DROP DEFAULT,
      ALTER COLUMN verification_status TYPE varchar(20)
        USING (CASE WHEN verification_status THEN 'VERIFIED' ELSE 'PENDING' END)`);
    await queryRunner.query(`ALTER TABLE factory_profiles
      ALTER COLUMN verification_status SET DEFAULT 'PENDING',
      ADD CONSTRAINT "CHK_factory_verification_status"
        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED'))`);
    await queryRunner.query(
      `ALTER INDEX "IDX_8ff9463a83e5b34c87c32a0da1" RENAME TO "IDX_factory_verification_status"`,
    );

    await queryRunner.query(`CREATE TABLE factory_verification_reviews (
      id serial PRIMARY KEY,
      factory_profile_id integer NOT NULL REFERENCES factory_profiles(id) ON DELETE RESTRICT,
      reviewed_by_admin_id integer REFERENCES users(id) ON DELETE SET NULL,
      decision varchar(20) NOT NULL,
      reason varchar(1000),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "CHK_factory_verification_decision"
        CHECK ((decision = 'VERIFIED' AND reason IS NULL)
          OR (decision = 'REJECTED' AND reason IS NOT NULL AND length(btrim(reason)) > 0))
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_factory_review_profile_id"
      ON factory_verification_reviews (factory_profile_id, id)`);
    // পুরোনো অনুমোদনের সময় জানা থাকলে সেটি ইতিহাসে রাখা হয়।
    await queryRunner.query(`INSERT INTO factory_verification_reviews
      (factory_profile_id, reviewed_by_admin_id, decision, created_at)
      SELECT id, verified_by_admin_id, 'VERIFIED', verified_at
      FROM factory_profiles
      WHERE verification_status = 'VERIFIED' AND verified_at IS NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE factory_verification_reviews`);
    await queryRunner.query(`ALTER TABLE factory_profiles
      DROP CONSTRAINT "CHK_factory_verification_status",
      ALTER COLUMN verification_status DROP DEFAULT,
      ALTER COLUMN verification_status TYPE boolean USING (verification_status = 'VERIFIED')`);
    await queryRunner.query(
      `ALTER TABLE factory_profiles RENAME COLUMN verification_status TO is_verified`,
    );
    await queryRunner.query(
      `ALTER TABLE factory_profiles ALTER COLUMN is_verified SET DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_factory_verification_status" RENAME TO "IDX_8ff9463a83e5b34c87c32a0da1"`,
    );
  }
}
