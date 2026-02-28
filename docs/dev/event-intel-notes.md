# Event Intel Notes

## Section A — PDF Parsing Pipeline

- Status: implemented (merged at `ab61702`).
- Core service: `server/pdf-parser/event-intel/pdfParsingService.ts`.
- Current dependency gap: parser service expects an artifact loader abstraction to provide PDF buffers.

## Section C — Scraper & Watcher (Feed the Parsers)

Goal: ensure parsers always have schedule PDFs to ingest.

### C.1 `event_artifacts` table

Track discovered/downloaded artifacts per event:

- `id` (PK)
- `event_id` (FK → `events.id`)
- `brand`
- `artifact_type` (`RUN_SHEET` | `CONVENTION_SCHEDULE`)
- `source_url`
- `storage_key` (bucket/local path)
- `status` (`NEW` | `DOWNLOADED` | `FAILED`)
- `checksum` (nullable)
- `downloaded_at_utc` (nullable)
- `created_at_utc`

### C.2 Artifact loader abstraction

Implement loader used by parser service:

`loadEventArtifact(artifactId): { buffer: Buffer; brand: string; artifactType: string; eventId: string; }`

Backed by `event_artifacts` + file storage implementation (local disk / object storage).

### C.3 Brand event scraper

Per-brand scraper functions discover season/regionals events and upsert `events` rows:

- `brand`, `event_id`, `city`, `state`, `venue`, `start_date`, `end_date`, `event_url`

### C.4 Event watcher job

Scheduled/manual job that:

- scans upcoming events (`start_date` within N days)
- fetches event page HTML
- discovers schedule PDFs (run sheet / convention)
- upserts `event_artifacts`
- downloads PDFs to storage

### C.5 Manual/admin triggers

- `POST /admin/events/:eventId/scrape-artifacts`
- `POST /admin/event-intel/events/:eventId/parse/:artifactId`

Parser priority rule: parsing reliability and extensibility take precedence in architectural tradeoffs.