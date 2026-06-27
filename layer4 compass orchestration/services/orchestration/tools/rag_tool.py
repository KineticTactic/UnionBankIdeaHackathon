"""
rag_tool.py — LangChain tool wrapping the local RAG retriever.

[LLM:0] — no API calls; purely sentence-transformers + FAISS/sklearn.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Optional

from langchain_core.tools import tool

# Allow import from the monorepo root (chronos package is a sibling of layer4)
_REPO_ROOT = Path(__file__).parents[5]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


@tool
def retrieve_playbook_tool(
    query: str,
    k: int = 3,
    source_filter: Optional[str] = None,
) -> str:
    """
    Retrieve relevant retention playbook passages, product terms, or past outreach
    outcome records from the local knowledge base.

    Use this tool when you need:
    - Which channel and offer works best for a given customer segment
    - Product terms (FD rates, loan eligibility, fee waiver rules)
    - Historical outreach outcome benchmarks

    Args:
        query: Natural language description of what you need.
        k: Number of passages to return (default 3, max 5).
        source_filter: Restrict to one file — "retention_playbooks.md",
                       "product_terms.md", or "past_outreach_outcomes.json".

    Returns:
        JSON string with list of passages and their relevance scores.
    """
    try:
        from chronos.rag.retriever import retrieve
        results = retrieve(query, k=min(k, 5), source_filter=source_filter)
        return json.dumps(results, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": str(e), "results": []})
