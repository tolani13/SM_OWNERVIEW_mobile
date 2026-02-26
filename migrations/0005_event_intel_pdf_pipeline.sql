-- Event Intel PDF Parsing Pipeline (Section A - centerpiece)

CREATE TABLE IF NOT EXISTS "event_run_sheets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "brand" text NOT NULL,
  "session_name" text,
  "stage_name" text,
  "routine_number" text,
  "routine_name" text,
  "studio_name" text,
  "division" text,
  "age" text,
  "level" text,
  "category" text,
  "scheduled_time" text,
  "raw_line" text,
  "created_at_utc" timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT "event_run_sheets_event_id_events_id_fk"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "event_run_sheets_event_id_idx"
  ON "event_run_sheets"("event_id");
CREATE INDEX IF NOT EXISTS "event_run_sheets_brand_idx"
  ON "event_run_sheets"("brand");
CREATE INDEX IF NOT EXISTS "event_run_sheets_created_at_utc_idx"
  ON "event_run_sheets"("created_at_utc" DESC);

CREATE TABLE IF NOT EXISTS "event_convention_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "brand" text NOT NULL,
  "room_name" text,
  "block_label" text,
  "start_time" text,
  "end_time" text,
  "class_type" text,
  "faculty_name" text,
  "level" text,
  "created_at_utc" timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT "event_convention_schedules_event_id_events_id_fk"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "event_convention_schedules_event_id_idx"
  ON "event_convention_schedules"("event_id");
CREATE INDEX IF NOT EXISTS "event_convention_schedules_brand_idx"
  ON "event_convention_schedules"("brand");
CREATE INDEX IF NOT EXISTS "event_convention_schedules_created_at_utc_idx"
  ON "event_convention_schedules"("created_at_utc" DESC);

CREATE TABLE IF NOT EXISTS "parsing_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "brand" text NOT NULL,
  "artifact_id" text NOT NULL,
  "status" text NOT NULL,
  "rows_run_sheet" integer NOT NULL DEFAULT 0,
  "rows_convention" integer NOT NULL DEFAULT 0,
  "error_message" text,
  "created_at_utc" timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT "parsing_jobs_event_id_events_id_fk"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade,
  CONSTRAINT "parsing_jobs_status_check"
    CHECK ("status" IN ('PENDING', 'SUCCESS', 'FAILED', 'SCANNED_UNSUPPORTED'))
);

CREATE INDEX IF NOT EXISTS "parsing_jobs_event_id_idx"
  ON "parsing_jobs"("event_id");
CREATE INDEX IF NOT EXISTS "parsing_jobs_brand_idx"
  ON "parsing_jobs"("brand");
CREATE INDEX IF NOT EXISTS "parsing_jobs_artifact_id_idx"
  ON "parsing_jobs"("artifact_id");
CREATE INDEX IF NOT EXISTS "parsing_jobs_status_idx"
  ON "parsing_jobs"("status");
CREATE INDEX IF NOT EXISTS "parsing_jobs_created_at_utc_idx"
  ON "parsing_jobs"("created_at_utc" DESC);
