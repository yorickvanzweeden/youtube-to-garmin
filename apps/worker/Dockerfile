FROM python:3.14-slim

WORKDIR /app
COPY . .
ENV PYTHONPATH=/app/src

# Worker runtime is intentionally not implemented in Phase 0.
CMD ["python", "-m", "garmin_audio_worker"]
