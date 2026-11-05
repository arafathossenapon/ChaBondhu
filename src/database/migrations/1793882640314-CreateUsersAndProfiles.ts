import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersAndProfiles1793882640314 implements MigrationInterface {
    name = 'CreateUsersAndProfiles1793882640314'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "farmer_profiles" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "garden_name" character varying(200) NOT NULL, "division" character varying(100) NOT NULL, "district" character varying(100) NOT NULL, "upazila" character varying(100) NOT NULL, "village" character varying(150), "farm_size_acres" numeric(8,2), "description" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_77f5f5145225ffcaa3583fb0ee1" UNIQUE ("user_id"), CONSTRAINT "REL_77f5f5145225ffcaa3583fb0ee" UNIQUE ("user_id"), CONSTRAINT "PK_4718a4781e7bd8b1f701b9a3cc1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_77f5f5145225ffcaa3583fb0ee" ON "farmer_profiles" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b31c4724db6e7df570c9b98df6" ON "farmer_profiles" ("district") `);
        await queryRunner.query(`CREATE TABLE "factory_profiles" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "factory_name" character varying(200) NOT NULL, "representative_name" character varying(150) NOT NULL, "district" character varying(100) NOT NULL, "upazila" character varying(100) NOT NULL, "address" text, "is_verified" boolean NOT NULL DEFAULT false, "verified_at" TIMESTAMP WITH TIME ZONE, "verified_by_admin_id" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_db03a9414fb45afc95614cbb95e" UNIQUE ("user_id"), CONSTRAINT "REL_db03a9414fb45afc95614cbb95" UNIQUE ("user_id"), CONSTRAINT "PK_6eb20360bdf0aa668cc1292dc50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_db03a9414fb45afc95614cbb95" ON "factory_profiles" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f63c0d25bf4a22a7e2bf778b88" ON "factory_profiles" ("district") `);
        await queryRunner.query(`CREATE INDEX "IDX_8ff9463a83e5b34c87c32a0da1" ON "factory_profiles" ("is_verified") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "full_name" character varying(150) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "phone_number" character varying(20) NOT NULL, "role" character varying(20) NOT NULL DEFAULT 'GROWER', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_ace513fa30d485cfd25c11a9e4" ON "users" ("role") `);
        await queryRunner.query(`CREATE INDEX "IDX_20c7aea6112bef71528210f631" ON "users" ("is_active") `);
        await queryRunner.query(`ALTER TABLE "farmer_profiles" ADD CONSTRAINT "FK_77f5f5145225ffcaa3583fb0ee1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "factory_profiles" ADD CONSTRAINT "FK_db03a9414fb45afc95614cbb95e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "factory_profiles" ADD CONSTRAINT "FK_d5ca232f6cb1af4576c017484b0" FOREIGN KEY ("verified_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "factory_profiles" DROP CONSTRAINT "FK_d5ca232f6cb1af4576c017484b0"`);
        await queryRunner.query(`ALTER TABLE "factory_profiles" DROP CONSTRAINT "FK_db03a9414fb45afc95614cbb95e"`);
        await queryRunner.query(`ALTER TABLE "farmer_profiles" DROP CONSTRAINT "FK_77f5f5145225ffcaa3583fb0ee1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20c7aea6112bef71528210f631"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ace513fa30d485cfd25c11a9e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ff9463a83e5b34c87c32a0da1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f63c0d25bf4a22a7e2bf778b88"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db03a9414fb45afc95614cbb95"`);
        await queryRunner.query(`DROP TABLE "factory_profiles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b31c4724db6e7df570c9b98df6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_77f5f5145225ffcaa3583fb0ee"`);
        await queryRunner.query(`DROP TABLE "farmer_profiles"`);
    }

}
