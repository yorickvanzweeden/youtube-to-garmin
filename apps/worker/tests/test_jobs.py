from garmin_audio_worker.jobs import FailureCode, failure, object_name, task_name


def test_failure_retry_policy_is_explicit() -> None:
    assert failure(FailureCode.NETWORK, "timeout").retryable is True
    assert failure(FailureCode.INVALID_INPUT, "bad URL").retryable is False


def test_object_name_is_deterministic() -> None:
    digest = "a" * 64
    assert object_name("media-123", digest) == f"media/media-123/{digest}.mp3"


def test_task_name_is_stable_and_generation_specific() -> None:
    assert task_name("job-123", 0) == task_name("job-123", 0)
    assert task_name("job-123", 0) != task_name("job-123", 1)
