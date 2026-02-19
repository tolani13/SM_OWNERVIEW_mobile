ALTER TABLE "fees" ADD COLUMN IF NOT EXISTS "fee_type" text NOT NULL DEFAULT 'other';
ALTER TABLE "fees" ADD COLUMN IF NOT EXISTS "accounting_code" text;

UPDATE "fees"
SET "fee_type" = CASE
  WHEN lower("type") = 'tuition' THEN 'tuition'
  WHEN lower("type") = 'costume' THEN 'costume'
  WHEN lower("type") = 'competition' THEN 'competition'
  WHEN lower("type") = 'recital' THEN 'recital'
  ELSE 'other'
END
WHERE "fee_type" = 'other';
