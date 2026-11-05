import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateHarvestListings1793884438520 implements MigrationInterface {
    name = 'CreateHarvestListings1793884438520'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "harvest_listings" ("id" SERIAL NOT NULL, "farmer_profile_id" integer NOT NULL, "tea_grade" character varying(100) NOT NULL, "estimated_quantity_kg" numeric(10,3) NOT NULL, "expected_harvest_date" date NOT NULL, "last_harvest_date" date, "quality_description" text, "collection_location" character varying(255) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "notes" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_5e9c6a8bcacab280633537448c" CHECK ("estimated_quantity_kg" > 0), CONSTRAINT "PK_4f862f26bcd837fde77c07e5e35" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_809e0b0902fb70b357d2a86acc" ON "harvest_listings" ("farmer_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_872c0c5909643e576a4c90074a" ON "harvest_listings" ("tea_grade") `);
        await queryRunner.query(`CREATE INDEX "IDX_83fae27dfcbd12d82ccc0e8c6b" ON "harvest_listings" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_584215c16efbad1251221da365" ON "harvest_listings" ("is_active") `);
        await queryRunner.query(`CREATE INDEX "IDX_ad3df9dd96d1f3b04aa67fbef8" ON "harvest_listings" ("status", "is_active") `);
        await queryRunner.query(`ALTER TABLE "harvest_listings" ADD CONSTRAINT "FK_809e0b0902fb70b357d2a86accc" FOREIGN KEY ("farmer_profile_id") REFERENCES "farmer_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "harvest_listings" DROP CONSTRAINT "FK_809e0b0902fb70b357d2a86accc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ad3df9dd96d1f3b04aa67fbef8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_584215c16efbad1251221da365"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_83fae27dfcbd12d82ccc0e8c6b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_872c0c5909643e576a4c90074a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_809e0b0902fb70b357d2a86acc"`);
        await queryRunner.query(`DROP TABLE "harvest_listings"`);
    }

}
