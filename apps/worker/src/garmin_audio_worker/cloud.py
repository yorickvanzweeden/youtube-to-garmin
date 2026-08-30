"""Firestore and Cloud Storage adapters for media jobs."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Protocol

from google.cloud import firestore

from .jobs import JobState, object_name


@dataclass(frozen=True, slots=True)
class Job:
    id: str
    media_id: str
    source_url: str
    profile: str
    state: JobState


class JobStore:
    def __init__(self, client: firestore.Client) -> None:
        self.client = client

    def load(self, job_id: str) -> Job | None:
        job_snapshot = self.client.collection("jobs").document(job_id).get()
        if not job_snapshot.exists:
            return None
        data = job_snapshot.to_dict() or {}
        media_snapshot = self.client.collection("media").document(data["mediaId"]).get()
        media = media_snapshot.to_dict() or {}
        return Job(
            id=job_id,
            media_id=data["mediaId"],
            source_url=media["source"]["url"],
            profile=media["profile"],
            state=JobState(data.get("state", JobState.QUEUED)),
        )

    def acquire_lease(self, job_id: str, owner: str, ttl_seconds: int = 900) -> bool:
        reference = self.client.collection("jobs").document(job_id)
        transaction = self.client.transaction()
        snapshot = reference.get(transaction=transaction)
        if not snapshot.exists:
            return False
        data = snapshot.to_dict() or {}
        expires_at = data.get("lease", {}).get("expiresAt")
        if expires_at and expires_at > datetime.now(UTC):
            return False
        transaction.update(
            reference,
            {
                "lease": {
                    "owner": owner,
                    "expiresAt": datetime.now(UTC) + timedelta(seconds=ttl_seconds),
                },
                "heartbeatAt": datetime.now(UTC),
            },
        )
        transaction.commit()
        return True

    def mark_ready(self, job_id: str, media_id: str, output: dict[str, object]) -> None:
        now = datetime.now(UTC)
        batch = self.client.batch()
        batch.update(
            self.client.collection("jobs").document(job_id),
            {"state": JobState.READY.value, "completedAt": now},
        )
        batch.update(
            self.client.collection("media").document(media_id),
            {"status": "ready", "output": output, "updatedAt": now},
        )
        batch.commit()

    def mark_failed(self, job_id: str, media_id: str, error: dict[str, object]) -> None:
        now = datetime.now(UTC)
        batch = self.client.batch()
        batch.update(
            self.client.collection("jobs").document(job_id),
            {
                "state": JobState.FAILED.value,
                "error": error,
                "completedAt": now,
            },
        )
        batch.update(
            self.client.collection("media").document(media_id),
            {"status": "failed", "updatedAt": now},
        )
        batch.commit()


class BlobLike(Protocol):
    def upload_from_filename(self, filename: str, *, content_type: str, timeout: int) -> None: ...


class BucketLike(Protocol):
    def blob(self, name: str) -> BlobLike: ...


class MediaStorage:
    def __init__(self, bucket: BucketLike) -> None:
        self.bucket = bucket

    def upload(self, media_id: str, source: Path, content_sha256: str) -> dict[str, object]:
        name = object_name(media_id, content_sha256)
        blob = self.bucket.blob(name)
        blob.upload_from_filename(str(source), content_type="audio/mpeg", timeout=600)
        return {"object": name, "bytes": source.stat().st_size, "sha256": content_sha256}
