import os
from azure.ai.inference import ChatCompletionsClient
from azure.core.credentials import AzureKeyCredential
from langchain_openai import AzureChatOpenAI


def get_cognition_client() -> ChatCompletionsClient:
    return ChatCompletionsClient(
        endpoint=os.environ["AZURE_FOUNDRY_ENDPOINT"],
        credential=AzureKeyCredential(os.environ["AZURE_FOUNDRY_KEY"]),
        model="kimi-k2-6-thinking",
    )


def get_compass_client() -> ChatCompletionsClient:
    return ChatCompletionsClient(
        endpoint=os.environ["AZURE_FOUNDRY_ENDPOINT"],
        credential=AzureKeyCredential(os.environ["AZURE_FOUNDRY_KEY"]),
        model="kimi-k2-5",
    )


def get_langchain_cognition_llm() -> AzureChatOpenAI:
    return AzureChatOpenAI(
        azure_endpoint=os.environ["AZURE_FOUNDRY_ENDPOINT"],
        api_key=os.environ["AZURE_FOUNDRY_KEY"],
        model="kimi-k2-6-thinking",
        api_version="2024-12-01-preview",
        temperature=0.1,
        max_tokens=2000,
    )


def get_langchain_compass_llm() -> AzureChatOpenAI:
    return AzureChatOpenAI(
        azure_endpoint=os.environ["AZURE_FOUNDRY_ENDPOINT"],
        api_key=os.environ["AZURE_FOUNDRY_KEY"],
        model="kimi-k2-5",
        api_version="2024-12-01-preview",
        temperature=0.0,
        max_tokens=1000,
    )
