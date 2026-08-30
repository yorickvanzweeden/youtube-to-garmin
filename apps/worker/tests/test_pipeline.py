from collections.abc import Sequence
from pathlib import Path
from subprocess import CompletedProcess

import pytest

from garmin_audio_worker.pipeline import (
    AudioProfile,
    MediaProcessError,
    ffmpeg_command,
    process_media,
    sha256_file,
    ytdlp_command,
)
from garmin_audio_worker.sponsorblock import Segment, video_id


def test_commands_encode_garmin_profiles() -> None:
    music = ffmpeg_command(Path("in.wav"), Path("out.mp3"), AudioProfile.MUSIC)
    speech = ffmpeg_command(Path("in.wav"), Path("out.mp3"), AudioProfile.SPEECH)
    assert "128k" in music
    assert "96k" in speech
    assert "44100" in music


def test_video_id_supports_watch_and_short_urls() -> None:
    assert video_id("https://www.youtube.com/watch?v=abcdefghijk") == "abcdefghijk"
    assert video_id("https://youtu.be/abcdefghijk?t=4") == "abcdefghijk"


def test_ffmpeg_command_removes_sponsor_intervals() -> None:
    command = ffmpeg_command(Path("in.wav"), Path("out.mp3"), AudioProfile.MUSIC, [Segment(10, 20)])
    rendered = " ".join(command)
    assert "atrim=start=0.0:end=10" in rendered
    assert "atrim=start=20,asetpts" in rendered
    assert "concat=n=2" in rendered


def test_ytdlp_rejects_non_http_sources() -> None:
    with pytest.raises(ValueError):
        ytdlp_command("file:///secret", Path("out.wav"))


def test_process_media_hashes_normalized_output(tmp_path: Path) -> None:
    calls: list[Sequence[str]] = []

    def runner(command: Sequence[str]) -> CompletedProcess[str]:
        calls.append(command)
        if command[0] == "ffmpeg":
            Path(command[-1]).write_bytes(b"normalized audio")
        return CompletedProcess(command, 0, "Example title\n", "")

    result = process_media("https://youtu.be/example", tmp_path, AudioProfile.MUSIC, runner)
    assert result.bytes == len(b"normalized audio")
    assert result.sha256 == sha256_file(result.path)
    assert result.title == "Example title"
    assert [call[0] for call in calls] == ["yt-dlp", "ffmpeg"]


def test_download_failure_is_retryable(tmp_path: Path) -> None:
    def runner(command: Sequence[str]) -> CompletedProcess[str]:
        return CompletedProcess(command, 1, "", "temporary upstream failure")

    with pytest.raises(MediaProcessError) as raised:
        process_media("https://youtu.be/example", tmp_path, AudioProfile.SPEECH, runner)
    assert raised.value.failure.retryable is True
