"""Pure job-state rules shared by the Cloud Run worker and its tests."""

from dataclasses import dataclass
from enum import StrEnum
from hashlib import sha256


class JobState(StrEnum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    TRANSCODING = "transcoding"
    UPLOADING = "uploading"
    READY = "ready"
    FAILED = "failed"


class FailureCode(StrEnum):
    SOURCE_UNAVAILABLE = "source_unavailable"
    NETWORK = "network"
    INVALID_INPUT = "invalid_input"
    UNSUPPORTED_SOURCE = "unsupported_source"
    STORAGE = "storage"


@dataclass(frozen=True, slots=True)
class Failure:
    code: FailureCode
    message: str
    retryable: bool


RETRYABLE_FAILURES = {
    FailureCode.SOURCE_UNAVAILABLE,
    FailureCode.NETWORK,
    FailureCode.STORAGE,
}


def failure(code: FailureCode, message: str) -> Failure:
    """Build a normalized failure, keeping retry policy in one place."""

    return Failure(code=code, message=message, retryable=code in RETRYABLE_FAILURES)


def object_name(media_id: str, content_sha256: str) -> str:
    """Return the deterministic GCS object path for a completed media item."""

    if not media_id or not content_sha256:
        raise ValueError("media_id and content_sha256 are required")
    if len(content_sha256) != 64 or any(char not in "0123456789abcdef" for char in content_sha256):
        raise ValueError("content_sha256 must be a lowercase SHA-256 digest")
    return f"media/{media_id}/{content_sha256}.mp3"


def task_name(job_id: str, launch_generation: int) -> str:
    """Return a stable Cloud Tasks name, making enqueueing idempotent."""

    if not job_id or launch_generation < 0:
        raise ValueError("job_id and a non-negative launch_generation are required")
    digest = sha256(f"{job_id}:{launch_generation}".encode()).hexdigest()
    return f"launch-{digest}"
