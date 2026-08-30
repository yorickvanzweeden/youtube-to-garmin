from dataclasses import dataclass
from typing import cast

from garmin_audio_worker.cloud import Job, JobStore, MediaStorage
from garmin_audio_worker.jobs import FailureCode, JobState, failure
from garmin_audio_worker.pipeline import MediaProcessError
from garmin_audio_worker.runner import run_job


@dataclass
class FakeStore:
    job: Job
    failed: tuple[str, str, dict[str, object]] | None = None
    states: list[JobState] | None = None

    def load(self, job_id: str) -> Job:
        return self.job

    def acquire_lease(self, job_id: str, owner: str) -> bool:
        return True

    def mark_state(self, job_id: str, media_id: str, state: JobState) -> None:
        if self.states is None:
            self.states = []
        self.states.append(state)

    def mark_failed(self, job_id: str, media_id: str, error: dict[str, object]) -> None:
        self.failed = (job_id, media_id, error)


def test_retryable_processing_failure_persists_media_identity(monkeypatch) -> None:
    job = Job(
        "job-1",
        "media-1",
        "https://youtube.com/watch?v=x",
        "music-128",
        JobState.QUEUED,
    )
    store = FakeStore(job)

    def fail_processing(*args, **kwargs):
        raise MediaProcessError(failure(FailureCode.NETWORK, "timeout"))

    monkeypatch.setattr("garmin_audio_worker.runner.process_media", fail_processing)
    result = run_job("job-1", cast(JobStore, store), cast(MediaStorage, object()))

    assert result == 1
    assert store.failed == (
        "job-1",
        "media-1",
        {"code": "network", "message": "timeout", "retryable": True},
    )
    assert store.states == [JobState.DOWNLOADING]
