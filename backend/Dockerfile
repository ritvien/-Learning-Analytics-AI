# =============================================================================
# EduInsight Backend — Multi-stage Dockerfile
# =============================================================================
# Stage 1 (builder): install dependencies into an isolated virtualenv.
# Stage 2 (runtime): copy only the venv + source; no build tools in prod image.
# =============================================================================

# ─── Stage 1: builder ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Create virtualenv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install dependencies (layer-cached until pyproject.toml changes)
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install ".[dev]"

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Non-root user for security
RUN groupadd --system app && useradd --system --gid app --no-create-home app

WORKDIR /app

# Pull in the fully installed venv from builder (no pip in runtime image)
COPY --from=builder /opt/venv /opt/venv

# Copy application source
COPY --chown=app:app . .

# Entrypoint: convert CRLF to LF to avoid 'Illegal option' errors on Windows, then run migrations & start server
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

USER app

EXPOSE 8000

ENTRYPOINT ["sh", "entrypoint.sh"]
