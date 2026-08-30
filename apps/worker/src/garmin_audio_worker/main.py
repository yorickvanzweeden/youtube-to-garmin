"""Cloud Run Job entry point.

The cloud adapters are deliberately kept behind this small boundary so the
state machine can be tested without credentials or network access.
"""

import os
import sys

from google.cloud import firestore, storage

from .cloud import JobStore, MediaStorage
from .runner import run_job


def main() -> int:
    job_id = os.environ.get("JOB_ID", "").strip()
    if not job_id:
        print("JOB_ID is required", file=sys.stderr)
        return 2
    bucket_name = os.environ.get("GCS_MEDIA_BUCKET", "").strip()
    if not bucket_name:
        print("GCS_MEDIA_BUCKET is required", file=sys.stderr)
        return 2
    return run_job(
        job_id, JobStore(firestore.Client()), MediaStorage(storage.Client().bucket(bucket_name))
    )


if __name__ == "__main__":
    raise SystemExit(main())
