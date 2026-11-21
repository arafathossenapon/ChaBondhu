import * as argon2 from "argon2";
import { DataSource, EntityManager } from "typeorm";
import { z } from "zod";
import { Role } from "@/common/enums/role.enum";
import { dataSourceOptions } from "@/config/database.config";
import { User } from "@/modules/users/entities/user.entity";

const settings = z.object({
  NODE_ENV: z.literal("development"),
  CHABONDHU_ADMIN_EMAIL: z.string().trim().toLowerCase().email().max(255),
  CHABONDHU_ADMIN_PASSWORD: z.string().min(8),
  CHABONDHU_ADMIN_NAME: z.string().trim().min(2).max(150),
  CHABONDHU_ADMIN_PHONE: z.string().trim().min(6).max(20),
});

export async function provisionDevelopmentAdmin(
  manager: EntityManager,
  env: NodeJS.ProcessEnv,
): Promise<"created" | "already-exists" | "email-in-use" | "inactive-admin"> {
  const config = settings.parse(env);
  return manager.transaction(async (transaction) => {
    // একই সময়ে দুইবার কমান্ড চালালেও প্রথম অ্যাডমিন একবারই তৈরি হয়।
    await transaction.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "chabondhu:provision-first-development-admin",
    ]);
    const users = transaction.getRepository(User);
    if (await users.existsBy({ role: Role.ADMIN, isActive: true })) {
      return "already-exists";
    }
    if (await users.existsBy({ role: Role.ADMIN })) return "inactive-admin";
    if (
      await users
        .createQueryBuilder("account")
        .where("LOWER(account.email) = :email", {
          email: config.CHABONDHU_ADMIN_EMAIL,
        })
        .getExists()
    ) {
      return "email-in-use";
    }
    await users.insert({
      fullName: config.CHABONDHU_ADMIN_NAME,
      email: config.CHABONDHU_ADMIN_EMAIL,
      phoneNumber: config.CHABONDHU_ADMIN_PHONE,
      passwordHash: await argon2.hash(config.CHABONDHU_ADMIN_PASSWORD),
      role: Role.ADMIN,
      isActive: true,
    });
    return "created";
  });
}

async function run(): Promise<void> {
  if (!settings.safeParse(process.env).success) {
    console.error(
      "Set NODE_ENV=development and valid CHABONDHU_ADMIN_EMAIL, CHABONDHU_ADMIN_PASSWORD, CHABONDHU_ADMIN_NAME and CHABONDHU_ADMIN_PHONE values.",
    );
    process.exitCode = 1;
    return;
  }
  const dataSource = new DataSource(dataSourceOptions);
  try {
    await dataSource.initialize();
    const result = await provisionDevelopmentAdmin(
      dataSource.manager,
      process.env,
    );
    switch (result) {
      case "created":
        console.log("Development admin created.");
        break;
      case "already-exists":
        console.log("An active admin already exists.");
        break;
      case "email-in-use":
        console.error(
          "An account already uses that email. Choose an unused email.",
        );
        process.exitCode = 1;
        break;
      case "inactive-admin":
        console.error(
          "An inactive admin already exists. Review that account before provisioning.",
        );
        process.exitCode = 1;
        break;
    }
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (require.main === module) {
  run().catch(() => {
    console.error(
      "Admin provisioning failed. Check the development database connection and migration status.",
    );
    process.exitCode = 1;
  });
}
