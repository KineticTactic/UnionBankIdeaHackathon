import os
import logging
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

_DEFAULT_ENDPOINT = "https://kensara.services.ai.azure.com/models"


def get_scribe_llm() -> ChatOpenAI:
    # Azure AI Foundry /models endpoint is OpenAI-compatible (Azure AI Inference)
    return ChatOpenAI(
        base_url=os.environ.get("AZURE_FOUNDRY_ENDPOINT", _DEFAULT_ENDPOINT),
        model=os.environ.get("SCRIBE_MODEL", "DeepSeek-V3"),
        api_key=os.environ.get("AZURE_API_KEY", "placeholder"),
        temperature=0.3,
        max_tokens=2000,
    )
