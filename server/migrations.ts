import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";

type Logger = (message: string, source?: string) => void;

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "migrations");

async function hasCoreTables(): Promise<boolean> {
  const result = await db.execute(
    sql<{ dancers: string | null }>`select to_regclass('public.dancers') as dancers`,
  );

  return Boolean(result.rows[0]?.dancers);
}

async function ensureDancerAgeLevelColumns(log: Logger): Promise<void> {
  await db.execute(sql`ALTER TABLE "dancers" ADD COLUMN IF NOT EXISTS "age" integer`);
  await db.execute(sql`ALTER TABLE "dancers" ADD COLUMN IF NOT EXISTS "level" text`);
  log("ensured dancers.age and dancers.level columns", "db");
}

export async function ensureDatabaseSchema(log?: Logger): Promise<void> {
  const logger: Logger =
    log ??
    ((message, source = "db") => {
      console.log(`[${source}] ${message}`);
    });

  if (!fs.existsSync(MIGRATIONS_FOLDER)) {
    logger(
      `migrations folder not found at ${MIGRATIONS_FOLDER}; skipping schema bootstrap`,
      "db",
    );
    await ensureDancerAgeLevelColumns(logger);
    return;
  }

  const coreTablesExist = await hasCoreTables();
  if (coreTablesExist) {
    logger("core tables already exist; skipping startup migrations", "db");
    await ensureDancerAgeLevelColumns(logger);
    return;
  }

  logger("core tables missing; applying startup migrations", "db");
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await ensureDancerAgeLevelColumns(logger);
  logger("startup migrations applied", "db");
}
