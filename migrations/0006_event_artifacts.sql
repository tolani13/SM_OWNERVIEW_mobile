-- Event Intel Artifacts Layer (Section C Task 1)

CREATE TABLE IF NOT EXISTS "event_artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "brand" text NOT NULL,
  "artifact_type" text NOT NULL,
  "source_url" text NOT NULL,
  "storage_key" text NOT NULL,
  "status" text NOT NULL,
  "checksum" text,
  "downloaded_at_utc" timestamptz,
  "created_at_utc" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "event_artifacts_event_id_events_id_fk"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade,
  CONSTRAINT "event_artifacts_artifact_type_check"
    CHECK ("artifact_type" IN ('RUN_SHEET', 'CONVENTION_SCHEDULE')),
  CONSTRAINT "event_artifacts_status_check"
    CHECK ("status" IN ('NEW', 'DOWNLOADED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS "event_artifacts_event_id_idx"
  ON "event_artifacts"("event_id");
CREATE INDEX IF NOT EXISTS "event_artifacts_brand_idx"
  ON "event_artifacts"("brand");
CREATE INDEX IF NOT EXISTS "event_artifacts_artifact_type_idx"
  ON "event_artifacts"("artifact_type");
CREATE INDEX IF NOT EXISTS "event_artifacts_status_idx"
  ON "event_artifacts"("status");
CREATE INDEX IF NOT EXISTS "event_artifacts_created_at_utc_idx"
  ON "event_artifacts"("created_at_utc" DESC);
CREATE INDEX IF NOT EXISTS "event_artifacts_event_brand_type_status_created_idx"
  ON "event_artifacts"("event_id", "brand", "artifact_type", "status", "created_at_utc" DESC);