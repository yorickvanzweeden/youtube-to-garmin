from garmin_audio_worker import __doc__
from garmin_audio_worker.__main__ import main as package_main
from garmin_audio_worker.main import main as cloud_run_main


def test_worker_package_is_importable() -> None:
    assert __doc__


def test_package_entrypoint_uses_cloud_run_runner() -> None:
    assert package_main is cloud_run_main
