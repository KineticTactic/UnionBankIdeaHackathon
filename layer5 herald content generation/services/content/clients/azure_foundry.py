import os
import logging
from langchain_openai import AzureChatOpenAI

logger = logging.getLogger(__name__)


def get_scribe_llm() -> AzureChatOpenAI:
    return AzureChatOpenAI(
        azure_endpoint=os.environ.get("AZURE_FOUNDRY_ENDPOINT", "https://placeholder.azure.com"),
        azure_deployment=os.environ.get("SCRIBE_MODEL", "kimi-k2-5"),
        api_version="2024-10-01-preview",
        api_key=os.environ.get("AZURE_API_KEY", "placeholder"),
        temperature=0.3,
        max_tokens=2000,
    )
