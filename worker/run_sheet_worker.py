from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional, Tuple

import boto3
import psycopg
from botocore.config import Config
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parents[1]
RUN_NORMALIZER_SCRIPT = REPO_ROOT / "server" / "scripts" / "runSheetWorkerNormalize.ts"
PROCESSING_STATUS = "processing"
NEEDS_REVIEW_STATUS = "needs_review"
ERROR_STATUS = "error"
SUPPORTED_SOURCE_TYPES = {"COMPETITION_RUN_SHEET"}
DEFAULT_POLL_SECONDS = int(os.environ.get("RUN_SHEET_WORKER_POLL_SECONDS", "5"))
DEFAULT_BATCH_SIZE = int(os.environ.get("RUN_SHEET_WORKER_BATCH_SIZE", "10"))
SELECT_JOB_COLUMNS = """
    id,
    source_type,
    parser_type,
    status,
    artifact_type,
    original_file_url,
    artifact_storage_key,
    error_message,
    created_by_user_id,
    studio_id,
    provider_key,
    event_id,
    competition_id,
    lock_at,
    event_timezone,
    published_at,
    created_at,
    updated_at
"""


def load_local_env_file() -> None:
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        normalized_key = key.strip()
        normalized_value = value.strip().strip('"').strip("'")
        os.environ.setdefault(normalized_key, normalized_value)


load_local_env_file()


class LockedJobError(RuntimeError):
    pass


class MaterializedArtifact:
    def __init__(self, path: Path, temp_dir: Optional[tempfile.TemporaryDirectory] = None):
        self.path = path
        self.temp_dir = temp_dir

    def cleanup(self) -> None:
        if self.temp_dir is not None:
            self.temp_dir.cleanup()


def require_database_url() -> str:
    value = os.environ.get("DATABASE_URL", "").strip()
    if not value:
        raise RuntimeError("DATABASE_URL is required for the run-sheet worker.")
    return value


def get_poll_seconds() -> int:
    return max(DEFAULT_POLL_SECONDS, 1)


def get_batch_size() -> int:
    return max(DEFAULT_BATCH_SIZE, 1)


def get_artifact_backend() -> str:
    raw = os.environ.get("ARTIFACT_STORAGE_BACKEND", "local").strip().lower()
    return "s3" if raw == "s3" else "local"


def get_local_artifact_base_dir() -> Path:
    configured = (
        os.environ.get("ARTIFACTS_LOCAL_BASE_DIR", "").strip()
        or os.environ.get("EVENT_ARTIFACTS_BASE_DIR", "").strip()
    )
    if configured:
        return Path(configured).resolve()
    return (REPO_ROOT / "artifacts").resolve()


def build_s3_client() -> Tuple[Any, str]:
    endpoint = os.environ.get("ARTIFACT_STORAGE_S3_ENDPOINT", "").strip()
    bucket = os.environ.get("ARTIFACT_STORAGE_S3_BUCKET", "").strip()
    access_key_id = os.environ.get("ARTIFACT_STORAGE_S3_ACCESS_KEY_ID", "").strip()
    secret_access_key = os.environ.get("ARTIFACT_STORAGE_S3_SECRET_ACCESS_KEY", "").strip()
    session_token = os.environ.get("ARTIFACT_STORAGE_S3_SESSION_TOKEN", "").strip() or None
    region = os.environ.get("ARTIFACT_STORAGE_S3_REGION", "auto").strip() or "auto"
    force_path_style = os.environ.get("ARTIFACT_STORAGE_S3_FORCE_PATH_STYLE", "true").strip().lower() != "false"

    if not endpoint or not bucket or not access_key_id or not secret_access_key:
        raise RuntimeError(
            "S3 artifact storage is enabled but required env vars are missing "
            "(ARTIFACT_STORAGE_S3_ENDPOINT, ARTIFACT_STORAGE_S3_BUCKET, "
            "ARTIFACT_STORAGE_S3_ACCESS_KEY_ID, ARTIFACT_STORAGE_S3_SECRET_ACCESS_KEY)."
        )

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        aws_session_token=session_token,
        region_name=region,
        config=Config(s3={"addressing_style": "path" if force_path_style else "virtual"}),
    )
    return client, bucket


def materialize_artifact(job: dict) -> MaterializedArtifact:
    storage_key = str(job.get("artifact_storage_key") or "").strip()
    if not storage_key:
        raise RuntimeError("artifact_storage_key is required on run_sheet_imports rows.")

    if get_artifact_backend() == "s3":
        client, bucket = build_s3_client()
        temp_dir = tempfile.TemporaryDirectory(prefix="run-sheet-worker-")
        local_path = Path(temp_dir.name) / Path(storage_key).name
        client.download_file(bucket, storage_key, str(local_path))
        return MaterializedArtifact(local_path, temp_dir)

    local_path = Path(storage_key)
    if not local_path.is_absolute():
        local_path = get_local_artifact_base_dir() / storage_key
    local_path = local_path.resolve()

    if not local_path.exists():
        raise FileNotFoundError(f"Artifact file not found at {local_path}.")

    return MaterializedArtifact(local_path)


def resolve_npx_executable() -> str:
    for candidate in ("npx", "npx.cmd"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise RuntimeError("npx was not found on PATH; it is required to invoke the shared normalizer.")


def run_shared_normalizer(job: dict, pdf_path: Path) -> list[dict]:
    if not RUN_NORMALIZER_SCRIPT.exists():
        raise RuntimeError(f"Normalizer helper not found at {RUN_NORMALIZER_SCRIPT}.")

    command = [
        resolve_npx_executable(),
        "tsx",
        str(RUN_NORMALIZER_SCRIPT.relative_to(REPO_ROOT)),
        "--pdf",
        str(pdf_path),
        "--provider-key",
        str(job.get("provider_key") or ""),
        "--parser-type",
        str(job.get("parser_type") or "AUTO"),
    ]

    completed = subprocess.run(
        command,
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        details = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(details or f"Shared normalizer command failed with code {completed.returncode}.")

    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to decode shared normalizer output: {exc}") from exc

    entries = payload.get("entries")
    if not isinstance(entries, list):
        raise RuntimeError("Shared normalizer output did not contain an entries array.")

    return entries


def short_error_message(error: Exception) -> str:
    raw = str(error).strip() or error.__class__.__name__
    first_line = raw.splitlines()[0]
    if len(first_line) > 240:
        return f"{first_line[:237]}..."
    return first_line


def enforce_lock(job: dict) -> None:
    lock_at = job.get("lock_at")
    if lock_at is None:
        return

    timezone_name = str(job.get("event_timezone") or "UTC").strip() or "UTC"
    try:
        tz = ZoneInfo(timezone_name)
    except Exception as exc:  # pragma: no cover - defensive path
        raise RuntimeError(f"Invalid event timezone {timezone_name}.") from exc

    if lock_at.tzinfo is None:
        lock_at = lock_at.replace(tzinfo=timezone.utc)

    now_in_event_tz = datetime.now(tz)
    if now_in_event_tz >= lock_at.astimezone(tz):
        raise LockedJobError("locked")


def connect() -> psycopg.Connection:
    return psycopg.connect(require_database_url(), autocommit=True, row_factory=dict_row)


def load_processing_candidates(conn: psycopg.Connection, limit: int) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT {SELECT_JOB_COLUMNS}
            FROM run_sheet_imports
            WHERE status = %s
            ORDER BY created_at ASC
            LIMIT %s
            """,
            (PROCESSING_STATUS, limit),
        )
        return list(cur.fetchall())


def load_job_by_id(conn: psycopg.Connection, job_id: str) -> Optional[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT {SELECT_JOB_COLUMNS}
            FROM run_sheet_imports
            WHERE id = %s
            LIMIT 1
            """,
            (job_id,),
        )
        return cur.fetchone()


def try_lock_job(conn: psycopg.Connection, job_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT pg_try_advisory_lock(hashtext(%s)) AS locked", (job_id,))
        row = cur.fetchone()
        return bool(row and row.get("locked"))


def unlock_job(conn: psycopg.Connection, job_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (job_id,))


def claim_next_job(conn: psycopg.Connection) -> Optional[Dict[str, Any]]:
    for candidate in load_processing_candidates(conn, get_batch_size()):
        job_id = str(candidate["id"])
        if not try_lock_job(conn, job_id):
            continue

        refreshed = load_job_by_id(conn, job_id)
        if refreshed and refreshed.get("status") == PROCESSING_STATUS:
            return refreshed

        unlock_job(conn, job_id)

    return None


def mark_job_error(conn: psycopg.Connection, job_id: str, message: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE run_sheet_imports
            SET status = %s,
                error_message = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (ERROR_STATUS, message, job_id),
        )


def persist_competition_rows(conn: psycopg.Connection, job: dict, entries: list[dict]) -> None:
    competition_id = str(job.get("competition_id") or "").strip()
    if not competition_id:
        raise RuntimeError("Competition import job is missing competition_id.")

    if not entries:
        raise RuntimeError("Parser returned no rows.")

    row_values = []
    for entry in entries:
        row_values.append(
            (
                uuid.uuid4().hex,
                competition_id,
                str(job["id"]),
                entry.get("entryNumber"),
                entry.get("routineName"),
                entry.get("division"),
                entry.get("style"),
                entry.get("groupSize"),
                entry.get("studioName"),
                entry.get("performanceTime"),
                entry.get("day"),
                entry.get("notes"),
                entry.get("placement"),
                entry.get("award"),
            )
        )

    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute("DELETE FROM competition_run_sheets WHERE import_job_id = %s", (job["id"],))
            cur.executemany(
                """
                INSERT INTO competition_run_sheets (
                    id,
                    competition_id,
                    import_job_id,
                    entry_number,
                    routine_name,
                    division,
                    style,
                    group_size,
                    studio_name,
                    performance_time,
                    day,
                    notes,
                    placement,
                    award
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """,
                row_values,
            )
            cur.execute(
                """
                UPDATE run_sheet_imports
                SET status = %s,
                    error_message = NULL,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (NEEDS_REVIEW_STATUS, job["id"]),
            )


def process_job(conn: psycopg.Connection, job: dict) -> None:
    source_type = str(job.get("source_type") or "").strip()
    if source_type not in SUPPORTED_SOURCE_TYPES:
        raise RuntimeError(f"Unsupported source_type {source_type}.")

    enforce_lock(job)
    artifact = materialize_artifact(job)
    try:
        entries = run_shared_normalizer(job, artifact.path)
        persist_competition_rows(conn, job, entries)
    finally:
        artifact.cleanup()


def worker_loop(run_once: bool) -> int:
    with connect() as conn:
        print("[run-sheet-worker] connected to database", flush=True)
        while True:
            job = claim_next_job(conn)
            if job is None:
                if run_once:
                    print("[run-sheet-worker] no processing jobs found", flush=True)
                    return 0
                time.sleep(get_poll_seconds())
                continue

            job_id = str(job["id"])
            print(f"[run-sheet-worker] claimed job {job_id}", flush=True)
            try:
                process_job(conn, job)
                print(f"[run-sheet-worker] job {job_id} -> {NEEDS_REVIEW_STATUS}", flush=True)
            except Exception as error:
                traceback.print_exc()
                mark_job_error(conn, job_id, short_error_message(error))
                print(f"[run-sheet-worker] job {job_id} -> {ERROR_STATUS}: {short_error_message(error)}", flush=True)
            finally:
                unlock_job(conn, job_id)

            if run_once:
                continue


def main() -> int:
    run_once = "--once" in sys.argv
    return worker_loop(run_once=run_once)


if __name__ == "__main__":
    raise SystemExit(main())





