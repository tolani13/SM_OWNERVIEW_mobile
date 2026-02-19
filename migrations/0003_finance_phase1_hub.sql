-- Dancers: normalize for finance hub
ALTER TABLE "dancers" ADD COLUMN IF NOT EXISTS "birthdate" date;
ALTER TABLE "dancers" ADD COLUMN IF NOT EXISTS "is_competition_dancer" boolean NOT NULL DEFAULT false;

UPDATE "dancers"
SET "level" = CASE lower(coalesce("level", ''))
  WHEN 'mini' THEN 'mini'
  WHEN 'junior' THEN 'junior'
  WHEN 'teen' THEN 'teen'
  WHEN 'senior' THEN 'senior'
  WHEN 'elite' THEN 'elite'
  ELSE 'mini'
END
WHERE "level" IS NULL OR lower("level") NOT IN ('mini', 'junior', 'teen', 'senior', 'elite');

UPDATE "dancers"
SET "birthdate" = CASE
  WHEN "birthdate" IS NOT NULL THEN "birthdate"
  WHEN "date_of_birth" ~ '^\d{4}-\d{2}-\d{2}$' THEN "date_of_birth"::date
  WHEN "age" IS NOT NULL AND "age" > 0 THEN (CURRENT_DATE - make_interval(years => "age"))::date
  ELSE DATE '2015-01-01'
END
WHERE "birthdate" IS NULL;

ALTER TABLE "dancers" ALTER COLUMN "birthdate" SET NOT NULL;
ALTER TABLE "dancers" ALTER COLUMN "level" SET DEFAULT 'mini';
ALTER TABLE "dancers" ALTER COLUMN "level" SET NOT NULL;

-- Events
CREATE TABLE IF NOT EXISTS "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "type" text NOT NULL DEFAULT 'other',
  "season_year" integer NOT NULL,
  "due_date" date,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Event fees (status summary per dancer/event)
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
);

CREATE INDEX IF NOT EXISTS "event_fees_dancer_id_idx" ON "event_fees"("dancer_id");
CREATE INDEX IF NOT EXISTS "event_fees_event_id_idx" ON "event_fees"("event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "event_fees_dancer_event_unique_idx" ON "event_fees"("dancer_id", "event_id");

-- Fee type defaults (optional accounting mappings)
CREATE TABLE IF NOT EXISTS "fee_types" (
  "fee_type" text PRIMARY KEY,
  "label" text NOT NULL,
  "default_quickbooks_item_id" text,
  "default_quickbooks_account_id" text,
  "default_wave_income_account_id" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

INSERT INTO "fee_types" ("fee_type", "label")
VALUES
  ('tuition', 'Tuition'),
  ('costume', 'Costume'),
  ('competition', 'Competition Fee'),
  ('recital', 'Recital Fee'),
  ('other', 'Other')
ON CONFLICT ("fee_type") DO NOTHING;

-- Canonical ledger
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
);

CREATE INDEX IF NOT EXISTS "transactions_dancer_id_idx" ON "transactions"("dancer_id");
CREATE INDEX IF NOT EXISTS "transactions_date_idx" ON "transactions"("date");
CREATE INDEX IF NOT EXISTS "transactions_event_fee_id_idx" ON "transactions"("event_fee_id");
CREATE INDEX IF NOT EXISTS "transactions_fee_type_idx" ON "transactions"("fee_type");

-- Backfill from legacy fees into canonical transactions
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
WHERE t."id" IS NULL;

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
  AND t."id" IS NULL;
