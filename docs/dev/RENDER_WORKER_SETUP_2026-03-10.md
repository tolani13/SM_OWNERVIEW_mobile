# Render Worker Setup — Run-Sheet Import Worker

## Manual Render worker configuration

Use this when creating the background worker service for Phase 2.

- Service type: `Background Worker`
- Environment: `Node`
- Root directory: repository root
- Build command: `npm install && python -m pip install -r worker/requirements.txt`
- Start command: `python worker/run_sheet_worker.py`

## Required environment variables

- `DATABASE_URL`
- `ARTIFACT_STORAGE_BACKEND`
- `ARTIFACTS_LOCAL_BASE_DIR` for local/disk-backed artifacts, if you do not want the default `./artifacts`
- `ARTIFACT_STORAGE_S3_ENDPOINT` when `ARTIFACT_STORAGE_BACKEND=s3`
- `ARTIFACT_STORAGE_S3_BUCKET` when `ARTIFACT_STORAGE_BACKEND=s3`
- `ARTIFACT_STORAGE_S3_ACCESS_KEY_ID` when `ARTIFACT_STORAGE_BACKEND=s3`
- `ARTIFACT_STORAGE_S3_SECRET_ACCESS_KEY` when `ARTIFACT_STORAGE_BACKEND=s3`
- `ARTIFACT_STORAGE_S3_REGION` optional, defaults to `auto`
- `ARTIFACT_STORAGE_S3_FORCE_PATH_STYLE` optional, defaults to `true`
- `ARTIFACT_STORAGE_S3_SESSION_TOKEN` optional
- `RUN_SHEET_WORKER_POLL_SECONDS` optional, defaults to `5`
- `RUN_SHEET_WORKER_BATCH_SIZE` optional, defaults to `10`

## Notes

- The worker intentionally calls `npx tsx server/scripts/runSheetWorkerNormalize.ts` so normalization stays on the existing shared TypeScript normalizer.
- The API and worker use the same artifact storage env var names.
- `--once` is available for local smoke tests: `python worker/run_sheet_worker.py --once`

## UNKNOWN

- Render runtime validation is still required for the mixed Node + Python build command above. This repo now documents the exact commands, but the live Render worker has not yet been booted from this branch.

