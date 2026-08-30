"""Small, fail-open client for the public SponsorBlock API."""

import json
from dataclasses import dataclass
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen


@dataclass(frozen=True, slots=True)
class Segment:
    start: float
    end: float


def video_id(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.hostname in {"youtu.be", "www.youtu.be"}:
        candidate = parsed.path.strip("/").split("/")[0]
    else:
        candidate = parse_qs(parsed.query).get("v", [""])[0]
    return candidate if len(candidate) == 11 else None


def fetch_segments(url: str, timeout: float = 5.0) -> list[Segment]:
    """Return sponsor segments; callers should treat network errors as no segments."""
    identifier = video_id(url)
    if identifier is None:
        return []
    endpoint = (
        "https://sponsor.ajay.app/api/skipSegments?videoID="
        f"{quote(identifier)}&categories=%5B%22sponsor%22%5D"
    )
    request = Request(endpoint, headers={"Accept": "application/json"})
    with urlopen(request, timeout=timeout) as response:
        payload = json.load(response)
    return [
        Segment(float(item["segment"][0]), float(item["segment"][1]))
        for item in payload
        if item.get("segment") and item["segment"][1] > item["segment"][0]
    ]
