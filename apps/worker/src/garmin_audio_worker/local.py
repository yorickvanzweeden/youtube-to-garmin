"""Residential-IP worker loop for systemd-hosted deployments."""

import os
import time

from google.cloud import firestore, storage

from .cloud import JobStore, MediaStorage
from .runner import run_job


def main() -> int:
    bucket_name = os.environ.get("GCS_MEDIA_BUCKET", "").strip()
    if not bucket_name:
        raise SystemExit("GCS_MEDIA_BUCKET is required")
    interval = int(os.environ.get("WORKER_POLL_INTERVAL_SECONDS", "15"))
    store = JobStore(firestore.Client())
    media_storage = MediaStorage(storage.Client().bucket(bucket_name))
    while True:
        jobs = store.queued_job_ids(limit=10)
        for job_id in jobs:
            os.environ["JOB_ID"] = job_id
            run_job(job_id, store, media_storage)
        time.sleep(interval)


if __name__ == "__main__":
    raise SystemExit(main())
