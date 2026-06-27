"""
retriever.py — Module-level singleton retriever (zero API cost, CPU-only).

Loads the pre-built index once at import time (lazy, on first call).
Exports retrieve(query, k, filters) for use by COMPASS tool.

[LLM:0] — only sentence-transformers inference, no external API calls.
"""
from __future__ import annotations

import json
import logging
import pickle
import threading
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

_INDEX_DIR = Path(__file__).parent / "index"
MODEL_NAME = "all-MiniLM-L6-v2"

_lock = threading.Lock()
_model = None
_backend: str | None = None       # "faiss" | "sklearn"
_index: Any = None                 # faiss.Index | sklearn NearestNeighbors
_embeddings: np.ndarray | None = None
_chunks: list[dict] | None = None


def _ensure_loaded():
    global _model, _backend, _index, _embeddings, _chunks
    if _chunks is not None:
        return

    with _lock:
        if _chunks is not None:
            return

        meta_path = _INDEX_DIR / "metadata.json"
        if not meta_path.exists():
            logger.warning(
                "RAG index not found at %s. Run: python -m chronos.rag.build_index", _INDEX_DIR
            )
            _chunks = []
            return

        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        _chunks = meta["chunks"]
        _backend = meta.get("backend", "sklearn")
        _embeddings = np.load(str(_INDEX_DIR / "embeddings.npy"))

        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(meta.get("model", MODEL_NAME))

        if _backend == "faiss":
            import faiss
            _index = faiss.read_index(str(_INDEX_DIR / "faiss.index"))
        else:
            with open(_INDEX_DIR / "sklearn_nn.pkl", "rb") as f:
                _index = pickle.load(f)

        logger.info("RAG index loaded: %d chunks, backend=%s", len(_chunks), _backend)


def retrieve(query: str, k: int = 3, source_filter: str | None = None) -> list[dict]:
    """
    Return top-k chunks most relevant to query.

    Args:
        query: Natural language search query.
        k: Number of results to return.
        source_filter: Optional filename to restrict results (e.g. "retention_playbooks.md").

    Returns:
        List of dicts with keys: text, source, section, score.
    """
    _ensure_loaded()

    if not _chunks:
        return []

    query_vec = _model.encode([query], normalize_embeddings=True).astype("float32")

    fetch_k = min(k * 5, len(_chunks))   # overfetch to allow filtering

    if _backend == "faiss":
        scores, indices = _index.search(query_vec, fetch_k)
        raw = [(float(scores[0][i]), int(indices[0][i])) for i in range(fetch_k)
               if indices[0][i] != -1]
    else:
        distances, indices = _index.kneighbors(query_vec, n_neighbors=fetch_k)
        raw = [(1.0 - float(distances[0][i]), int(indices[0][i])) for i in range(fetch_k)]

    results = []
    seen_sections: set[str] = set()
    for score, idx in sorted(raw, key=lambda x: x[0], reverse=True):
        chunk = _chunks[idx]
        if source_filter and chunk["source"] != source_filter:
            continue
        # de-duplicate by section heading
        key = f"{chunk['source']}::{chunk['section']}"
        if key in seen_sections:
            continue
        seen_sections.add(key)
        results.append({**chunk, "score": round(score, 4)})
        if len(results) >= k:
            break

    return results
