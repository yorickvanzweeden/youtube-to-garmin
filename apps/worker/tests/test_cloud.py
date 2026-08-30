from pathlib import Path

from garmin_audio_worker.cloud import MediaStorage


class FakeBlob:
    def __init__(self) -> None:
        self.uploaded: tuple[str, str, int] | None = None

    def upload_from_filename(self, filename: str, *, content_type: str, timeout: int) -> None:
        self.uploaded = (filename, content_type, timeout)


class FakeBucket:
    def __init__(self) -> None:
        self.blob_instance = FakeBlob()

    def blob(self, name: str) -> FakeBlob:
        assert name.startswith("media/")
        return self.blob_instance


def test_storage_upload_returns_deterministic_metadata(tmp_path: Path) -> None:
    source = tmp_path / "audio.mp3"
    source.write_bytes(b"audio")
    bucket = FakeBucket()
    result = MediaStorage(bucket).upload("media-1", source, "b" * 64)
    assert result == {"object": f"media/media-1/{'b' * 64}.mp3", "bytes": 5, "sha256": "b" * 64}
    assert bucket.blob_instance.uploaded == (str(source), "audio/mpeg", 600)
