"""
build_index.py — Build and persist the RAG index from corpus documents.

Uses sentence-transformers all-MiniLM-L6-v2 (CPU-friendly, ~80MB) and
sklearn's NearestNeighbors (pure Python, no FAISS binary dependency needed).
Falls back to FAISS if available.

Usage:
    python -m chronos.rag.build_index           # build to default ./index/
    python -m chronos.rag.build_index --out /path/to/index
"""
import argparse
import json
import logging
import pickle
from pathlib import Path
from typing import NamedTuple

logger = logging.getLogger(__name__)

_CORPUS_DIR = Path(__file__).parent / "corpus"
_DEFAULT_OUT = Path(__file__).parent / "index"

MODEL_NAME = "all-MiniLM-L6-v2"
CHUNK_SIZE = 300   # words per chunk
CHUNK_OVERLAP = 50


class Chunk(NamedTuple):
    text: str
    source: str
    section: str


def _load_markdown(path: Path) -> list[Chunk]:
    text = path.read_text(encoding="utf-8")
    sections = text.split("\n## ")
    chunks = []
    for sec in sections:
        lines = sec.strip().split("\n")
        heading = lines[0].strip("# ").strip() if lines else path.stem
        body = " ".join(lines[1:])
        words = body.split()
        for i in range(0, max(1, len(words)), CHUNK_SIZE - CHUNK_OVERLAP):
            chunk_words = words[i: i + CHUNK_SIZE]
            if len(chunk_words) < 10:
                continue
            chunks.append(Chunk(
                text=" ".join(chunk_words),
                source=path.name,
                section=heading,
            ))
    return chunks


def _load_json(path: Path) -> list[Chunk]:
    records = json.loads(path.read_text(encoding="utf-8"))
    chunks = []
    for rec in records:
        text_parts = []
        for k, v in rec.items():
            if isinstance(v, list):
                text_parts.append(f"{k}: {', '.join(str(x) for x in v)}")
            else:
                text_parts.append(f"{k}: {v}")
        text = ". ".join(text_parts)
        chunks.append(Chunk(
            text=text,
            source=path.name,
            section=rec.get("segment", path.stem),
        ))
    return chunks


def load_corpus() -> list[Chunk]:
    chunks: list[Chunk] = []
    for p in sorted(_CORPUS_DIR.iterdir()):
        if p.suffix == ".md":
            chunks.extend(_load_markdown(p))
        elif p.suffix == ".json":
            chunks.extend(_load_json(p))
    logger.info(f"Loaded {len(chunks)} chunks from {_CORPUS_DIR}")
    return chunks


def build_index(out_dir: Path = _DEFAULT_OUT):
    from sentence_transformers import SentenceTransformer
    import numpy as np

    out_dir.mkdir(parents=True, exist_ok=True)

    chunks = load_corpus()
    texts = [c.text for c in chunks]

    logger.info(f"Encoding {len(texts)} chunks with {MODEL_NAME} ...")
    model = SentenceTransformer(MODEL_NAME)
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=True, normalize_embeddings=True)

    # Try FAISS first; fall back to sklearn NearestNeighbors
    try:
        import faiss
        dim = embeddings.shape[1]
        index = faiss.IndexFlatIP(dim)   # inner product == cosine (vectors normalised)
        index.add(embeddings.astype("float32"))
        faiss.write_index(index, str(out_dir / "faiss.index"))
        backend = "faiss"
        logger.info(f"FAISS index written ({index.ntotal} vectors, dim={dim})")
    except ImportError:
        from sklearn.neighbors import NearestNeighbors
        nn = NearestNeighbors(n_neighbors=10, metric="cosine", algorithm="brute")
        nn.fit(embeddings)
        with open(out_dir / "sklearn_nn.pkl", "wb") as f:
            pickle.dump(nn, f)
        backend = "sklearn"
        logger.info(f"sklearn NearestNeighbors index written ({len(embeddings)} vectors)")

    meta = {"chunks": [c._asdict() for c in chunks], "backend": backend, "model": MODEL_NAME}
    with open(out_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    np.save(str(out_dir / "embeddings.npy"), embeddings)

    logger.info(f"Index built → {out_dir}  (backend={backend})")
    return out_dir


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=_DEFAULT_OUT)
    args = parser.parse_args()
    build_index(args.out)
