from typing import Self

from garmin_audio_worker import sponsorblock


class FakeResponse:
    def __enter__(self) -> Self:
        return self

    def __exit__(self, *args: object) -> None:
        return None


def test_invalid_video_url_skips_network_request(monkeypatch) -> None:
    called = False

    def fail_if_called(*args, **kwargs):
        nonlocal called
        called = True
        raise AssertionError("network should not be used")

    monkeypatch.setattr(sponsorblock, "urlopen", fail_if_called)
    assert sponsorblock.fetch_segments("https://example.com/video") == []
    assert called is False


def test_fetch_segments_filters_invalid_entries(monkeypatch) -> None:
    requests = []
    monkeypatch.setattr(
        sponsorblock,
        "urlopen",
        lambda request, timeout: requests.append((request, timeout)) or FakeResponse(),
    )
    monkeypatch.setattr(
        sponsorblock.json,
        "load",
        lambda response: [
            {"segment": [10, 20]},
            {"segment": [30, 30]},
            {"category": "intro"},
        ],
    )

    assert sponsorblock.fetch_segments("https://youtu.be/abcdefghijk", timeout=3) == [
        sponsorblock.Segment(10.0, 20.0)
    ]
    assert len(requests) == 1
    assert "videoID=abcdefghijk" in requests[0][0].full_url
    assert requests[0][1] == 3
