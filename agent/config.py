"""Runtime configuration and production safety checks for the public agent API."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Optional
from urllib.parse import urlparse


@dataclass(frozen=True)
class AgentConfig:
    runtime: str
    backend_url: str
    cors_origins: tuple[str, ...]


def _http_url(value: str, key: str, *, production: bool) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError(f"[config] {key} must be an absolute HTTP(S) URL")
    host = (parsed.hostname or "").lower()
    if production and (
        host in {"localhost", "127.0.0.1", "::1"}
        or host.endswith(".trycloudflare.com")
    ):
        raise RuntimeError(f"[config] {key} must use a persistent production origin")
    return value.rstrip("/")


def load_agent_config(env: Optional[Mapping[str, str]] = None) -> AgentConfig:
    source = env if env is not None else __import__("os").environ
    runtime = source.get("ASSAY_RUNTIME", "development")
    if runtime not in {"development", "test", "production"}:
        raise RuntimeError(f"[config] unsupported ASSAY_RUNTIME: {runtime}")
    production = runtime == "production"

    if production and source.get("ASSAY_TEST_SETTLE") == "1":
        raise RuntimeError("[config] ASSAY_TEST_SETTLE=1 is forbidden in production")
    if production and source.get("ASSAY_MOCK_PAY") == "1":
        raise RuntimeError("[config] ASSAY_MOCK_PAY=1 is forbidden in production")

    backend = source.get("ASSAY_BACKEND_URL")
    if production and not backend:
        raise RuntimeError("[config] ASSAY_BACKEND_URL is required in production")
    backend_url = _http_url(
        backend or "http://localhost:4000",
        "ASSAY_BACKEND_URL",
        production=production,
    )

    cors_origins = tuple(
        origin.strip().rstrip("/")
        for origin in source.get("CORS_ORIGIN", "http://localhost:3000").split(",")
        if origin.strip()
    )
    if production and (not cors_origins or "*" in cors_origins):
        raise RuntimeError("[config] production CORS_ORIGIN must contain explicit origins")
    for origin in cors_origins:
        _http_url(origin, "CORS_ORIGIN", production=False)

    return AgentConfig(runtime, backend_url, cors_origins)
