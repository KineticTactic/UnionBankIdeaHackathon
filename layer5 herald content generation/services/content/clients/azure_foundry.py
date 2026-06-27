# Backwards-compat shim — use nvidia_client directly for new code.
from .nvidia_client import get_scribe_llm, track_llm_call  # noqa: F401
