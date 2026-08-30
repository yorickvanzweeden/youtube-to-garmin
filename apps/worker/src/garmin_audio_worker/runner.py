"""Orchestrate one idempotent Cloud Run media job."""

import socket
from pathlib import Path
from tempfile import TemporaryDirectory

from .cloud import JobStore, MediaStorage
from .pipeline import AudioProfile, MediaProcessError, process_media


def run_job(job_id: str, store: JobStore, media_storage: MediaStorage) -> int:
    job = store.load(job_id)
    if job is None:
        return _fail(store, job_id, "job_not_found", "Job does not exist", False)
    if job.state.value == "ready":
        return 0
    if not store.acquire_lease(job_id, socket.gethostname()):
        return 0

    try:
        profile = AudioProfile(job.profile)
        with TemporaryDirectory(prefix=f"garmin-{job.id}-") as directory:
            result = process_media(job.source_url, Path(directory), profile)
            output = media_storage.upload(job.media_id, result.path, result.sha256)
        store.mark_ready(job.id, job.media_id, output)
        return 0
    except MediaProcessError as error:
        return _fail(store, job.id, error.failure.code.value, str(error), error.failure.retryable)
    except Exception as error:  # noqa: BLE001 - Cloud Run must persist unexpected failures
        return _fail(store, job.id, "worker_error", str(error), True)


def _fail(store: JobStore, job_id: str, code: str, message: str, retryable: bool) -> int:
    store.mark_failed(job_id, {"code": code, "message": message, "retryable": retryable})
    return 1 if retryable else 0
