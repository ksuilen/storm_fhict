from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, Field, SecretStr
from typing import List, Optional, Literal

# Definieer de mogelijke retrievers
RetrieverType = Literal["you", "bing", "brave", "serper", "duckduckgo", "tavily", "searxng", "azure_ai_search"]

class Settings(BaseSettings):
    APP_NAME: str = "Storm WebApp"
    DATABASE_URL: str = "sqlite:///./storm_app.db"

    # JWT Settings
    SECRET_KEY: SecretStr = Field(default="default_secret_key_for_development_only") # Use SecretStr
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Storm Settings
    OPENAI_API_KEY: Optional[SecretStr] = None
    OPENAI_API_TYPE: Literal["openai", "azure"] = "openai"
    AZURE_API_BASE: Optional[str] = None
    AZURE_API_VERSION: Optional[str] = None
    GPT_4_MODEL_NAME: Optional[str] = "gpt-4o" # Voor OpenAI type, of als fallback
    GPT_35_MODEL_NAME_AZURE: Optional[str] = "gpt-4o-mini" # Default voor Azure GPT-3.5 class
    GPT_4_MODEL_NAME_AZURE: Optional[str] = "gpt-4o"    # Default voor Azure GPT-4 class
    
    # Retriever Choice and Keys (Voeg keys toe voor de retrievers die je wilt ondersteunen)
    STORM_RETRIEVER: RetrieverType = "tavily" # Default retriever
    YDC_API_KEY: Optional[SecretStr] = None # Use SecretStr, make Optional
    BING_SEARCH_API_KEY: Optional[SecretStr] = None
    BRAVE_API_KEY: Optional[SecretStr] = None
    SERPER_API_KEY: Optional[SecretStr] = None
    TAVILY_API_KEY: Optional[SecretStr] = None
    SEARXNG_API_KEY: Optional[SecretStr] = None
    AZURE_AI_SEARCH_API_KEY: Optional[SecretStr] = None
    # DuckDuckGo heeft geen API key nodig in het voorbeeld

    # Andere LLM Keys (optioneel, n.a.v. env)
    GROQ_API_KEY: Optional[SecretStr] = None

    # STORMWikiRunnerArguments
    STORM_OUTPUT_DIR: str = "./storm_output" # Waar Storm output opslaat
    STORM_MAX_CONV_TURN: int = 3
    STORM_MAX_PERSPECTIVE: int = 3
    STORM_SEARCH_TOP_K: int = 3
    STORM_MAX_THREAD_NUM: int = 3 # Aantal threads voor parallelle taken
    # Voeg eventueel STORM_RETRIEVE_TOP_K toe indien nodig

    class Config:
        env_file = "../.env" # Go one level up from backend/app/core
        env_file_encoding = 'utf-8'

settings = Settings() 