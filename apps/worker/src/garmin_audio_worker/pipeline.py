"""External media-process boundaries for the Cloud Run worker."""

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from hashlib import sha256
from pathlib import Path
from subprocess import CompletedProcess, run
from typing import Protocol

from .jobs import Failure, FailureCode, failure
from .sponsorblock import Segment, fetch_segments


class AudioProfile(StrEnum):
    MUSIC = "music-128"
    SPEECH = "speech-96"


class CommandRunner(Protocol):
    def __call__(self, command: Sequence[str]) -> CompletedProcess[str]: ...


@dataclass(frozen=True, slots=True)
class ProcessedMedia:
    path: Path
    bytes: int
    sha256: str


class MediaProcessError(RuntimeError):
    def __init__(self, process_failure: Failure):
        super().__init__(process_failure.message)
        self.failure = process_failure


def ytdlp_command(url: str, output: Path) -> list[str]:
    if not url.startswith(("https://", "http://")):
        raise ValueError("source URL must use HTTP(S)")
    return [
        "yt-dlp",
        "--no-playlist",
        "--extract-audio",
        "--audio-format",
        "wav",
        "--js-runtimes",
        "deno",
        "--output",
        str(output),
        url,
    ]


def ffmpeg_command(
    source: Path, output: Path, profile: AudioProfile, segments: Sequence[Segment] = ()
) -> list[str]:
    bitrate = "128k" if profile is AudioProfile.MUSIC else "96k"
    command = [
        "ffmpeg",
        "-nostdin",
        "-y",
        "-i",
        str(source),
        "-vn",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        bitrate,
    ]
    if segments:
        # SponsorBlock intervals are removed by constructing the complementary ranges.
        ranges: list[tuple[float, float | None]] = []
        cursor = 0.0
        for segment in sorted(segments, key=lambda item: item.start):
            if segment.start > cursor:
                ranges.append((cursor, segment.start))
            cursor = max(cursor, segment.end)
        ranges.append((cursor, None))  # Open-ended final interval ends at EOF.
        filters = ";".join(
            f"[0:a]atrim=start={start}{f':end={end}' if end is not None else ''},asetpts=PTS-STARTPTS[a{i}]"
            for i, (start, end) in enumerate(ranges)
            if end is None or end > start
        )
        labels = "".join(f"[a{i}]" for i in range(len(ranges)))
        filters += f";{labels}concat=n={len(ranges)}:v=0:a=1[out]"
        command += ["-filter_complex", filters, "-map", "[out]"]
    command += [str(output)]
    return command


def process_media(
    url: str,
    workdir: Path,
    profile: AudioProfile,
    runner: CommandRunner = lambda command: run(
        command, capture_output=True, text=True, check=False
    ),
) -> ProcessedMedia:
    workdir.mkdir(parents=True, exist_ok=True)
    source = workdir / "source.wav"
    output = workdir / "output.mp3"
    download = runner(ytdlp_command(url, source))
    if download.returncode != 0:
        raise MediaProcessError(failure(FailureCode.SOURCE_UNAVAILABLE, _stderr(download)))

    try:
        segments = fetch_segments(url)
    except OSError, ValueError, KeyError, TypeError:
        # SponsorBlock is an optional enhancement.
        segments = []
    transcode = runner(ffmpeg_command(source, output, profile, segments))
    if transcode.returncode != 0:
        raise MediaProcessError(failure(FailureCode.INVALID_INPUT, _stderr(transcode)))
    if not output.is_file() or output.stat().st_size == 0:
        raise MediaProcessError(
            failure(FailureCode.INVALID_INPUT, "FFmpeg produced no audio output")
        )

    digest = sha256_file(output)
    return ProcessedMedia(path=output, bytes=output.stat().st_size, sha256=digest)


def sha256_file(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _stderr(process: CompletedProcess[str]) -> str:
    message = (process.stderr or "process failed").strip()
    return message[-1000:]
