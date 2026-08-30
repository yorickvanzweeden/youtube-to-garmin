FROM python:3.14-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir \
    "google-cloud-firestore>=2.29.0" \
    "google-cloud-storage>=3.13.1" \
    "yt-dlp>=2026.8.19"

COPY src ./src
ENV PYTHONPATH=/app/src

RUN useradd --create-home --uid 10001 worker
USER worker

CMD ["python", "-m", "garmin_audio_worker"]
