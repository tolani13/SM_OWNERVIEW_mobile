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

async function ensureFeeAccountingColumns(log: Logger): Promise<void> {
  await db.execute(
    sql`ALTER TABLE "fees" ADD COLUMN IF NOT EXISTS "fee_type" text NOT NULL DEFAULT 'other'`,
  );
  await db.execute(sql`ALTER TABLE "fees" ADD COLUMN IF NOT EXISTS "accounting_code" text`);

  await db.execute(sql`
    UPDATE "fees"
    SET "fee_type" = CASE
      WHEN lower("type") = 'tuition' THEN 'tuition'
      WHEN lower("type") = 'costume' THEN 'costume'
      WHEN lower("type") = 'competition' THEN 'competition'
      WHEN lower("type") = 'recital' THEN 'recital'
      ELSE 'other'
    END
    WHERE "fee_type" = 'other'
  `);

  log("ensured fees.fee_type and fees.accounting_code columns", "db");
}

async function ensureFinanceHubSchema(log: Logger): Promise<void> {
  // families / guardians
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "families" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "family_name" text NOT NULL,
      "primary_contact_name" text,
      "primary_email" text,
      "primary_phone" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "guardians" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "first_name" text NOT NULL,
      "last_name" text NOT NULL,
      "email" text NOT NULL,
      "phone" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "family_guardians" (
      "family_id" uuid NOT NULL,
      "guardian_id" uuid NOT NULL,
      "role" text NOT NULL DEFAULT 'secondary',
      "is_primary" boolean NOT NULL DEFAULT false,
      CONSTRAINT "family_guardians_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE cascade,
      CONSTRAINT "family_guardians_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE cascade,
      CONSTRAINT "family_guardians_pk" PRIMARY KEY ("family_id", "guardian_id")
    )
  `);

  // dancers enhancements
  await db.execute(sql`ALTER TABLE "dancers" ADD COLUMN IF NOT EXISTS "family_id" uuid`);
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'dancers_family_id_families_id_fk'
      ) THEN
        ALTER TABLE "dancers"
          ADD CONSTRAINT "dancers_family_id_families_id_fk"
          FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE set null;
      END IF;
    END $$;
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "dancers_family_id_idx" ON "dancers"("family_id")`);

  await db.execute(sql`ALTER TABLE "dancers" ADD COLUMN IF NOT EXISTS "birthdate" date`);
  await db.execute(
    sql`ALTER TABLE "dancers" ADD COLUMN IF NOT EXISTS "is_competition_dancer" boolean NOT NULL DEFAULT false`,
  );

  await db.execute(sql`
    UPDATE "dancers"
    SET "level" = CASE lower(coalesce("level", ''))
      WHEN 'mini' THEN 'mini'
      WHEN 'junior' THEN 'junior'
      WHEN 'teen' THEN 'teen'
      WHEN 'senior' THEN 'senior'
      WHEN 'elite' THEN 'elite'
      ELSE 'mini'
    END
    WHERE "level" IS NULL OR lower("level") NOT IN ('mini', 'junior', 'teen', 'senior', 'elite')
  `);

  await db.execute(sql`
    UPDATE "dancers"
    SET "birthdate" = CASE
      WHEN "birthdate" IS NOT NULL THEN "birthdate"
      WHEN "date_of_birth" ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN "date_of_birth"::date
      WHEN "age" IS NOT NULL AND "age" > 0 THEN (CURRENT_DATE - make_interval(years => "age"))::date
      ELSE DATE '2015-01-01'
    END
    WHERE "birthdate" IS NULL
  `);

  await db.execute(sql`ALTER TABLE "dancers" ALTER COLUMN "birthdate" SET NOT NULL`);
  await db.execute(sql`ALTER TABLE "dancers" ALTER COLUMN "level" SET DEFAULT 'mini'`);
  await db.execute(sql`ALTER TABLE "dancers" ALTER COLUMN "level" SET NOT NULL`);

  // events table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" text NOT NULL,
      "type" text NOT NULL DEFAULT 'other',
      "season_year" integer NOT NULL,
      "due_date" date,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  // event_fees table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "event_fees" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "dancer_id" text NOT NULL,
      "event_id" uuid NOT NULL,
      "amount" numeric(10,2) NOT NULL DEFAULT '0.00',
      "balance" numeric(10,2) NOT NULL DEFAULT '0.00',
      "status" text NOT NULL DEFAULT 'unbilled',
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "event_fees_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "dancers"("id") ON DELETE cascade,
      CONSTRAINT "event_fees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "event_fees_dancer_id_idx" ON "event_fees"("dancer_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "event_fees_event_id_idx" ON "event_fees"("event_id")`);
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "event_fees_dancer_event_unique_idx" ON "event_fees"("dancer_id", "event_id")`,
  );

  // fee_types defaults table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "fee_types" (
      "fee_type" text PRIMARY KEY,
      "label" text NOT NULL,
      "default_quickbooks_item_id" text,
      "default_quickbooks_account_id" text,
      "default_xero_revenue_account_code" text,
      "default_xero_payment_account_code" text,
      "default_wave_income_account_id" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`ALTER TABLE "fee_types" ADD COLUMN IF NOT EXISTS "default_xero_revenue_account_code" text`);
  await db.execute(sql`ALTER TABLE "fee_types" ADD COLUMN IF NOT EXISTS "default_xero_payment_account_code" text`);

  await db.execute(sql`
    INSERT INTO "fee_types" ("fee_type", "label")
    VALUES
      ('tuition', 'Tuition'),
      ('costume', 'Costume'),
      ('competition', 'Competition Fee'),
      ('recital', 'Recital Fee'),
      ('other', 'Other')
    ON CONFLICT ("fee_type") DO NOTHING
  `);

  // canonical transactions ledger
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "transactions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "dancer_id" text NOT NULL,
      "date" timestamp NOT NULL DEFAULT now(),
      "type" text NOT NULL,
      "fee_type" text NOT NULL DEFAULT 'other',
      "amount" numeric(10,2) NOT NULL,
      "description" text,
      "event_fee_id" uuid,
      "quickbooks_item_id" text,
      "quickbooks_account_id" text,
      "wave_income_account_id" text,
      "external_id_quickbooks" text,
      "external_id_wave" text,
      "sync_status" text NOT NULL DEFAULT 'pending',
      "legacy_fee_id" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "transactions_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "dancers"("id") ON DELETE cascade,
      CONSTRAINT "transactions_event_fee_id_event_fees_id_fk" FOREIGN KEY ("event_fee_id") REFERENCES "event_fees"("id") ON DELETE set null
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "transactions_dancer_id_idx" ON "transactions"("dancer_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "transactions_date_idx" ON "transactions"("date")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "transactions_event_fee_id_idx" ON "transactions"("event_fee_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "transactions_fee_type_idx" ON "transactions"("fee_type")`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "accounting_connections" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "studio_key" text NOT NULL DEFAULT 'default',
      "provider" text NOT NULL,
      "is_active" boolean NOT NULL DEFAULT false,
      "status" text NOT NULL DEFAULT 'disconnected',
      "oauth_type" text NOT NULL DEFAULT 'oauth2',
      "access_token" text,
      "refresh_token" text,
      "token_expires_at" timestamp,
      "refresh_token_expires_at" timestamp,
      "scope" text,
      "realm_id" text,
      "tenant_id" text,
      "tenant_name" text,
      "external_user_id" text,
      "last_synced_at" timestamp,
      "last_error" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "accounting_connections_studio_provider_unique_idx"
      ON "accounting_connections"("studio_key", "provider")
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "accounting_sync_records" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "studio_key" text NOT NULL DEFAULT 'default',
      "provider" text NOT NULL,
      "connection_id" uuid,
      "transaction_id" uuid NOT NULL,
      "external_object_type" text NOT NULL DEFAULT 'other',
      "external_object_id" text,
      "idempotency_key" text NOT NULL,
      "fingerprint" text NOT NULL,
      "status" text NOT NULL DEFAULT 'pending',
      "retry_count" integer NOT NULL DEFAULT 0,
      "last_error" text,
      "synced_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "accounting_sync_records_tx_fk" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE cascade,
      CONSTRAINT "accounting_sync_records_connection_fk" FOREIGN KEY ("connection_id") REFERENCES "accounting_connections"("id") ON DELETE set null
    )
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "accounting_sync_records_studio_provider_tx_unique_idx"
      ON "accounting_sync_records"("studio_key", "provider", "transaction_id")
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "accounting_sync_records_studio_provider_idem_unique_idx"
      ON "accounting_sync_records"("studio_key", "provider", "idempotency_key")
  `);

  await db.execute(sql`
    UPDATE "transactions"
    SET "sync_status" = 'pending'
    WHERE "sync_status" IS NULL
      OR "sync_status" NOT IN ('pending', 'synced', 'failed')
  `);

  await db.execute(sql`
    INSERT INTO "accounting_connections" ("studio_key", "provider", "is_active", "status", "oauth_type")
    VALUES
      ('default', 'quickbooks', false, 'disconnected', 'oauth2'),
      ('default', 'xero', false, 'disconnected', 'oauth2_pkce')
    ON CONFLICT ("studio_key", "provider") DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO "transactions" (
      "dancer_id",
      "date",
      "type",
      "fee_type",
      "amount",
      "description",
      "legacy_fee_id",
      "sync_status"
    )
    SELECT
      f."dancer_id",
      COALESCE(NULLIF(f."due_date", '')::timestamp, now()),
      'charge',
      COALESCE(NULLIF(lower(f."fee_type"), ''), 'other'),
      COALESCE(NULLIF(f."amount", '')::numeric(10,2), 0),
      f."type",
      f."id",
      'pending'
    FROM "fees" f
    LEFT JOIN "transactions" t ON t."legacy_fee_id" = f."id" AND t."type" = 'charge'
    WHERE t."id" IS NULL
  `);

  await db.execute(sql`
    INSERT INTO "transactions" (
      "dancer_id",
      "date",
      "type",
      "fee_type",
      "amount",
      "description",
      "legacy_fee_id",
      "sync_status"
    )
    SELECT
      f."dancer_id",
      COALESCE(NULLIF(f."due_date", '')::timestamp, now()),
      'payment',
      COALESCE(NULLIF(lower(f."fee_type"), ''), 'other'),
      COALESCE(NULLIF(f."amount", '')::numeric(10,2), 0),
      CONCAT('Payment for ', f."type"),
      f."id",
      'pending'
    FROM "fees" f
    LEFT JOIN "transactions" t ON t."legacy_fee_id" = f."id" AND t."type" = 'payment'
    WHERE f."paid" = true
      AND t."id" IS NULL
  `);

  log("ensured Finance schema (families/guardians + events/event_fees/transactions/fee_types + dancers fields)", "db");
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
    await ensureFeeAccountingColumns(logger);
    await ensureFinanceHubSchema(logger);
    return;
  }

  const coreTablesExist = await hasCoreTables();
  if (coreTablesExist) {
    logger("core tables already exist; skipping startup migrations", "db");
    await ensureDancerAgeLevelColumns(logger);
    await ensureFeeAccountingColumns(logger);
    await ensureFinanceHubSchema(logger);
    return;
  }

  logger("core tables missing; applying startup migrations", "db");
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await ensureDancerAgeLevelColumns(logger);
  await ensureFeeAccountingColumns(logger);
  await ensureFinanceHubSchema(logger);
  logger("startup migrations applied", "db");
}
