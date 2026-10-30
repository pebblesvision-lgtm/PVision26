# pvsketch as a web app. Works on Render, Fly.io, Railway, Hugging Face Spaces,
# or any Docker host:  docker build -t pvsketch . && docker run -p 8000:8000 pvsketch
FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY pvsketch ./pvsketch
COPY samples ./samples

ENV PVSKETCH_WORKSPACE=/data/workspace \
    PVSKETCH_RETENTION_DAYS=14 \
    PORT=8000
RUN mkdir -p /data/workspace && chmod -R a+rwx /data
EXPOSE 8000

# one worker (GrabCut is CPU-bound and the project store is a folder), threads for the UI
CMD gunicorn --workers 1 --threads 4 --timeout 300 --bind 0.0.0.0:${PORT} "pvsketch.server.app:create_app()"
