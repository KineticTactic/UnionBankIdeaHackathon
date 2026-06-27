"""
nvidia_client.py — NVIDIA DeepSeek LLM client for HERALD.

Replaces the misleadingly-named azure_foundry.py.
Shares the same LLM call counter design as COMPASS nvidia_client.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Optional

from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

_DEFAULT_ENDPOINT = "https://integrate.api.nvidia.com/v1"
_NVIDIA_ENDPOINT = os.environ.get("NVIDIA_ENDPOINT", _DEFAULT_ENDPOINT)
_NVIDIA_KEY = os.environ.get("NVIDIA_API_KEY", "placeholder")
_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

_LOCAL_COUNTS: dict[str, int] = {}
_counter_lock = threading.Lock()
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
    except Exception:
        _redis_available = False
    return _redis_client if _redis_available else None


def track_llm_call(node: str) -> None:
    key = f"pcop:llm_calls:{node}"
    r = _get_redis()
    if r is not None:
        try:
            r.incr(key)
            r.expire(key, 86_400)
            r.incr("pcop:llm_calls:total")
            r.expire("pcop:llm_calls:total", 86_400)
            return
        except Exception:
            pass
    with _counter_lock:
        _LOCAL_COUNTS[node] = _LOCAL_COUNTS.get(node, 0) + 1
        _LOCAL_COUNTS["total"] = _LOCAL_COUNTS.get("total", 0) + 1


def get_scribe_llm(node: str = "scribe") -> ChatOpenAI:
    track_llm_call(node)
    return ChatOpenAI(
        base_url=_NVIDIA_ENDPOINT,
        api_key=_NVIDIA_KEY,
        model=os.environ.get("SCRIBE_MODEL", "deepseek-ai/deepseek-v4-pro"),
        temperature=float(os.environ.get("SCRIBE_TEMPERATURE", "0.3")),
        max_tokens=2000,
    )
