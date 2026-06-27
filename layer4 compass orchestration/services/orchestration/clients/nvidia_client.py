"""
nvidia_client.py — NVIDIA DeepSeek LLM clients for COMPASS.

Replaces the misleadingly-named azure_foundry.py.
All endpoints point at integrate.api.nvidia.com (free tier).

LLM call counter: every get_*_llm() call is counted and tagged by node.
Counters are stored in Redis (if available) and exposed via GET /api/llm-usage.
"""
from __future__ import annotations

import logging
import os
import threading
from functools import lru_cache
from typing import Optional

from langchain_openai import ChatOpenAI
from openai import OpenAI

logger = logging.getLogger(__name__)

_DEFAULT_ENDPOINT = "https://integrate.api.nvidia.com/v1"
_NVIDIA_ENDPOINT = os.environ.get("NVIDIA_ENDPOINT", _DEFAULT_ENDPOINT)
_NVIDIA_KEY = os.environ.get("NVIDIA_API_KEY", "placeholder")
_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# ── In-process fallback counter (used when Redis is unavailable) ──────────────
_LOCAL_COUNTS: dict[str, int] = {}
_counter_lock = threading.Lock()

# ── Redis connection (lazy, singleton) ───────────────────────────────────────
_redis_client: Optional[object] = None
_redis_available: Optional[bool] = None


def _get_redis():
    global _redis_client, _redis_available
    if _redis_available is not None:
        return _redis_client if _redis_available else None
    try:
        import redis
        client = redis.from_url(_REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        _redis_client = client
        _redis_available = True
        logger.info("[nvidia_client] Redis counter active")
    except Exception:
        _redis_available = False
        logger.warning("[nvidia_client] Redis unavailable — using in-process LLM counter")
    return _redis_client if _redis_available else None


def track_llm_call(node: str) -> None:
    """Increment the per-node LLM call counter (tagged, Redis-backed)."""
    key = f"pcop:llm_calls:{node}"
    r = _get_redis()
    if r is not None:
        try:
            r.incr(key)
            r.expire(key, 86_400)   # 24h TTL
            r.incr("pcop:llm_calls:total")
            r.expire("pcop:llm_calls:total", 86_400)
            return
        except Exception:
            pass
    with _counter_lock:
        _LOCAL_COUNTS[node] = _LOCAL_COUNTS.get(node, 0) + 1
        _LOCAL_COUNTS["total"] = _LOCAL_COUNTS.get("total", 0) + 1


def get_llm_usage() -> dict:
    """Return current LLM call counts (for /api/llm-usage endpoint)."""
    r = _get_redis()
    if r is not None:
        try:
            keys = r.keys("pcop:llm_calls:*")
            return {
                k.decode().replace("pcop:llm_calls:", ""): int(r.get(k) or 0)
                for k in keys
            }
        except Exception:
            pass
    with _counter_lock:
        return dict(_LOCAL_COUNTS)


# ── Client factories ──────────────────────────────────────────────────────────

def get_cognition_client() -> OpenAI:
    return OpenAI(base_url=_NVIDIA_ENDPOINT, api_key=_NVIDIA_KEY)


def get_compass_client() -> OpenAI:
    return OpenAI(base_url=_NVIDIA_ENDPOINT, api_key=_NVIDIA_KEY)


def get_langchain_cognition_llm(node: str = "cognition") -> ChatOpenAI:
    track_llm_call(node)
    return ChatOpenAI(
        base_url=_NVIDIA_ENDPOINT,
        api_key=_NVIDIA_KEY,
        model=os.environ.get("COGNITION_MODEL", "deepseek-ai/deepseek-v4-pro"),
        temperature=float(os.environ.get("COGNITION_TEMPERATURE", "0.1")),
        max_tokens=2000,
    )


def get_langchain_compass_llm(node: str = "compass_nba") -> ChatOpenAI:
    track_llm_call(node)
    return ChatOpenAI(
        base_url=_NVIDIA_ENDPOINT,
        api_key=_NVIDIA_KEY,
        model=os.environ.get("COMPASS_MODEL", "deepseek-ai/deepseek-v4-pro"),
        temperature=float(os.environ.get("COMPASS_TEMPERATURE", "0.0")),
        max_tokens=1000,
    )


def get_langchain_copilot_llm(node: str = "copilot") -> ChatOpenAI:
    track_llm_call(node)
    return ChatOpenAI(
        base_url=_NVIDIA_ENDPOINT,
        api_key=_NVIDIA_KEY,
        model=os.environ.get("COPILOT_MODEL", "deepseek-ai/deepseek-v4-pro"),
        temperature=float(os.environ.get("COPILOT_TEMPERATURE", "0.1")),
        max_tokens=1500,
    )
