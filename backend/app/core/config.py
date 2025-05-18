from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, Field, SecretStr
from typing import List, Optional, Literal
import os

# Bepaal het absolute pad naar de .env file dynamisch
CONFIG_PY_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CONFIG_PY_DIR, "..", "..", ".."))
ENV_FILE_PATH = os.path.join(PROJECT_ROOT, ".env")

# Definieer de mogelijke retrievers
RetrieverType = Literal["you", "bing", "brave", "serper", "duckduckgo", "tavily", "searxng", "azure_ai_search"]

class Settings(BaseSettings):
    APP_NAME: str = "Storm WebApp"
    DATABASE_URL: str = "sqlite:///./storm_app.db"

    # JWT Settings
    SECRET_KEY: SecretStr = Field(default="default_secret_key_for_development_only")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Storm Settings
    OPENAI_API_KEY: Optional[SecretStr] = None
    OPENAI_API_TYPE: Literal["openai", "azure"] = "openai"
    AZURE_API_BASE: Optional[str] = None
    AZURE_API_VERSION: Optional[str] = None
    OPENAI_API_BASE: Optional[str] = None

    # Generic model names
    SMALL_MODEL_NAME: Optional[str] = "gpt-3.5-turbo"
    LARGE_MODEL_NAME: Optional[str] = "gpt-4o"
    SMALL_MODEL_NAME_AZURE: Optional[str] = "gpt-4o-mini"
    LARGE_MODEL_NAME_AZURE: Optional[str] = "gpt-4o"
    
    # Retriever Choice and Keys
    STORM_RETRIEVER: RetrieverType = "tavily"
    YDC_API_KEY: Optional[SecretStr] = None
    BING_SEARCH_API_KEY: Optional[SecretStr] = None
    BRAVE_API_KEY: Optional[SecretStr] = None
    SERPER_API_KEY: Optional[SecretStr] = None
    TAVILY_API_KEY: Optional[SecretStr] = None
    SEARXNG_API_KEY: Optional[SecretStr] = None
    AZURE_AI_SEARCH_API_KEY: Optional[SecretStr] = None

    # Andere LLM Keys
    GROQ_API_KEY: Optional[SecretStr] = None

    # STORMWikiRunnerArguments
    STORM_OUTPUT_DIR: str = "./storm_output"
    STORM_MAX_CONV_TURN: int = 3
    STORM_MAX_PERSPECTIVE: int = 3
    STORM_SEARCH_TOP_K: int = 3
    STORM_MAX_THREAD_NUM: int = 3

    class Config:
        env_file = ENV_FILE_PATH
        env_file_encoding = 'utf-8'
        extra = 'ignore'

settings = Settings()

# Verwijderde "FINAL SETTINGS CHECK" 