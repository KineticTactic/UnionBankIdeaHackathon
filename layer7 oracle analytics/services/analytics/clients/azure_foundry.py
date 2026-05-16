import os
import logging
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

_DEFAULT_ENDPOINT = "https://kensara.services.ai.azure.com/models"


def get_narrate_llm() -> ChatOpenAI:
    # Azure AI Foundry /models endpoint is OpenAI-compatible (Azure AI Inference)
    return ChatOpenAI(
        base_url=os.environ.get("AZURE_FOUNDRY_ENDPOINT", _DEFAULT_ENDPOINT),
        model=os.environ.get("NARRATE_MODEL", "DeepSeek-V3"),
        api_key=os.environ.get("AZURE_API_KEY", "placeholder"),
        temperature=0.2,
        max_tokens=3000,
    )
