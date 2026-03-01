# Parsing Handoff — 2026-02-27 (EOD)

## Current Status
- Parsing is **still not fully correct** in real usage.
- User reports that an "easy" WCDE run sheet that used to work no longer works reliably.
- We should assume parser behavior is still unstable until reproduced directly through the exact UI/API flow being used.

## User Concern (must carry forward)
- "Something is still not correct with parsing."
- User suspects the **Python programs may be messed up**.

## What was changed today
1. Event Intel artifact loader + parse trigger were wired.
2. NYCDA parser baseline heuristics were added.
3. Event Intel upload/list/inspection endpoints were added.
4. WCDE fallback in Event Intel service was restored (generic parser fallback for non-NYCDA).
5. Generic parser tie-break was changed to avoid classifying run-sheets as convention on score ties.

## Why this is still unresolved
- There are now multiple parsing paths:
  - Legacy run-sheet import endpoint using Python scripts:  
    `POST /api/competitions/:competitionId/run-sheet/import`
  - Generic parser endpoint path:  
    `POST /api/competitions/:competitionId/parse-pdf`
  - Event Intel artifact parse path:  
    `POST /api/event-intel/events/:eventId/parse/:artifactId`
- A fix in one path may not resolve failures in another path.
- The user-facing failure likely needs exact reproduction using the same file + screen + endpoint they used.

## High-priority tomorrow checklist
1. Reproduce failure exactly from UI with the user’s failing WCDE file.
2. Capture request/response for the exact endpoint being hit.
3. Log parser selection decision (auto vs override) and parser vendor chosen.
4. Confirm Python script output for that same file directly:
   - `python parse_wcde_comp.py "<failing file path>"`
5. Compare Python output row count vs API returned row count.
6. If mismatch: fix route mapping/normalization layer.
7. If Python output itself is wrong: patch `parse_wcde_comp.py` first.

## Notes
- One generated artifact file is currently modified locally:
  - `attached_assets/wcde_competition_parsed.csv`
- This file is output from parser testing and should be treated as test artifact, not core logic.

---

## Tomorrow First-Priority Handoff — Schedule Ingestion Alignment + Security Hardening

**Date to resume:** 2026-03-01  
**Priority:** First work item tomorrow before feature work.

### Scope guardrails (must hold)
- Do **not** add product features.
- Apply only security hygiene, ingestion architecture alignment, and RBAC hardening.
- Keep imported schedule truth canonical in `run_slots` and `convention_classes`.

### Ordered execution plan for tomorrow
1. **Re-verify security baseline at start of day**
   - Confirm `.env` and `temp_env_for_claude.txt` are not tracked and absent from history.
   - Confirm `.gitignore` contains:
     - `.env`
     - `.env.*`
     - `!.env.example`
     - `temp_env_for_claude.txt`
   - Confirm rewritten history is force-pushed and remote is healthy.

2. **Audit current Event Intel ingestion architecture**
   - Map current schema/routes/storage/parser flow.
   - Identify all places that still do parsing inline during HTTP request.

3. **Create `run_sheet_imports` job table (per spec)**
   - Include fields for source_type (`upload|url|email`), parser_type, status (`processing|needs_review|published|error`), original_file_url, error_message, created_by_user_id, timestamps.

4. **Create `schedule_annotations` table (private overlay)**
   - Unique key: `(entity_type, entity_id, user_id)`.
   - Fields: notes, placement, award, timestamps.
   - Notes/annotations are private to author only.

5. **Add deterministic identity keys for imports**
   - Add `slot_key` for `run_slots`, `class_key` for `convention_classes`.
   - Add unique constraints.
   - Keys must be stable and must **not** include `performer_name` or `raw_code`.

6. **Refactor import endpoints to async job enqueue**
   - Endpoint creates `run_sheet_imports` row and returns immediately.
   - No parser execution inside request lifecycle.

7. **Implement worker process for imports**
   - Poll/claim `processing` jobs.
   - Select exactly one parser.
   - Parse and upsert normalized rows to canonical schedule tables.
   - Set status to `needs_review` or `error`.
   - User-facing error message short; full trace internal only.

8. **Implement lock rule**
   - `lock_at = earliest competition performance start_time - 12 hours` (event timezone).
   - Worker must refuse parse when `now >= lock_at` and set status `error` with `"locked"`.
   - Annotations remain editable.

9. **Enforce data/PII rules**
   - No notes/results on schedule rows.
   - `performer_name` stored only for Solo rows; otherwise `NULL`.
   - Unknown single-letter codes stored only as `raw_code` (no business logic).

10. **Harden auth/RBAC**
   - Remove spoofable header-based role trust for protected routes.
   - Gate Event Intel routes server-side to `SUPERADMIN/FOUNDER` only.

11. **Deliverables required at end of work**
   - File-by-file list of changed files.
   - Minimal acceptance checklist for each step above.

### Start-of-day verification checklist (copy/paste)
- [ ] `.env` not tracked
- [ ] `temp_env_for_claude.txt` not tracked
- [ ] No git history matches for those files
- [ ] `.gitignore` has required env rules
- [ ] Remote `origin` present and healthy

