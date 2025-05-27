from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, Field, SecretStr, validator
from typing import List, Optional, Literal
import os

# Bepaal het absolute pad naar de .env file dynamisch
CONFIG_PY_DIR = os.path.dirname(os.path.abspath(__file__))
# Voor lokale dev, willen we data relatief aan de 'backend' map
BACKEND_DIR = os.path.abspath(os.path.join(CONFIG_PY_DIR, "..")) # Gaat van app/core naar app
PROJECT_ROOT_FROM_CORE = os.path.abspath(os.path.join(CONFIG_PY_DIR, "..", "..")) # Gaat van app/core naar backend

# Definieer de mogelijke retrievers
RetrieverType = Literal["you", "bing", "brave", "serper", "duckduckgo", "tavily", "searxng", "azure_ai_search"]

class Settings(BaseSettings):
    APP_NAME: str = "Storm WebApp"
    APP_ENV: str = Field(default="local", env="APP_ENV") # Default naar 'local' als niet gezet
    API_V1_STR: str = "/api/v1"

    # Pad definities
    _DATABASE_URL_DOCKER: str = "sqlite:////data/database/storm_app.db"
    _DATABASE_URL_LOCAL_RELATIVE_PATH: str = "storm_local_dev.db" # Relatief aan backend dir

    _STORM_OUTPUT_DIR_DOCKER: str = "/data/storm_output"
    _STORM_OUTPUT_DIR_LOCAL_RELATIVE_PATH: str = "storm_output_local_dev" # Relatief aan backend dir

    # JWT Settings
    SECRET_KEY: SecretStr = Field(default="default_secret_key_for_development_only", env="SECRET_KEY")
    ALGORITHM: str = Field(default="HS256", env="ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")

    # Storm Settings & API Keys - nu met env support
    OPENAI_API_KEY: Optional[SecretStr] = Field(default=None, env="OPENAI_API_KEY")
    OPENAI_API_TYPE: Literal["openai", "azure"] = Field(default="openai", env="OPENAI_API_TYPE")
    AZURE_API_BASE: Optional[str] = Field(default=None, env="AZURE_API_BASE")
    AZURE_API_VERSION: Optional[str] = Field(default=None, env="AZURE_API_VERSION")
    OPENAI_API_BASE: Optional[str] = Field(default=None, env="OPENAI_API_BASE")

    SMALL_MODEL_NAME: Optional[str] = Field(default="gpt-3.5-turbo", env="SMALL_MODEL_NAME")
    LARGE_MODEL_NAME: Optional[str] = Field(default="gpt-4o", env="LARGE_MODEL_NAME")
    SMALL_MODEL_NAME_AZURE: Optional[str] = Field(default="gpt-4o-mini", env="SMALL_MODEL_NAME_AZURE")
    LARGE_MODEL_NAME_AZURE: Optional[str] = Field(default="gpt-4o", env="LARGE_MODEL_NAME_AZURE")
    
    STORM_RETRIEVER: RetrieverType = Field(default="tavily", env="STORM_RETRIEVER")
    YDC_API_KEY: Optional[SecretStr] = Field(default=None, env="YDC_API_KEY")
    BING_SEARCH_API_KEY: Optional[SecretStr] = Field(default=None, env="BING_SEARCH_API_KEY")
    BRAVE_API_KEY: Optional[SecretStr] = Field(default=None, env="BRAVE_API_KEY")
    SERPER_API_KEY: Optional[SecretStr] = Field(default=None, env="SERPER_API_KEY")
    TAVILY_API_KEY: Optional[SecretStr] = Field(default=None, env="TAVILY_API_KEY")
    SEARXNG_API_KEY: Optional[SecretStr] = Field(default=None, env="SEARXNG_API_KEY")
    AZURE_AI_SEARCH_API_KEY: Optional[SecretStr] = Field(default=None, env="AZURE_AI_SEARCH_API_KEY")

    GROQ_API_KEY: Optional[SecretStr] = Field(default=None, env="GROQ_API_KEY")

    STORM_MAX_CONV_TURN: int = Field(default=3, env="STORM_MAX_CONV_TURN")
    STORM_MAX_PERSPECTIVE: int = Field(default=3, env="STORM_MAX_PERSPECTIVE")
    STORM_SEARCH_TOP_K: int = Field(default=3, env="STORM_SEARCH_TOP_K")
    STORM_MAX_THREAD_NUM: int = Field(default=3, env="STORM_MAX_THREAD_NUM")
    
    # STORM Runner Version Selection
    STORM_RUNNER_VERSION: Literal["v1", "v2"] = Field(default="v1", env="STORM_RUNNER_VERSION")

    # Properties die de juiste URL/pad kiezen op basis van APP_ENV
    @property
    def DATABASE_URL(self) -> str:
        if self.APP_ENV == "docker":
            return self._DATABASE_URL_DOCKER
        # Voor lokaal, construeer pad relatief aan de backend directory (PROJECT_ROOT_FROM_CORE)
        return f"sqlite:///{os.path.join(PROJECT_ROOT_FROM_CORE, self._DATABASE_URL_LOCAL_RELATIVE_PATH)}"

    @property
    def STORM_OUTPUT_DIR(self) -> str:
        if self.APP_ENV == "docker":
            return self._STORM_OUTPUT_DIR_DOCKER
        # Voor lokaal, construeer pad relatief aan de backend directory (PROJECT_ROOT_FROM_CORE)
        return os.path.join(PROJECT_ROOT_FROM_CORE, self._STORM_OUTPUT_DIR_LOCAL_RELATIVE_PATH)

    model_config = SettingsConfigDict(
        env_file=os.path.join(PROJECT_ROOT_FROM_CORE, "..", ".env"), # .env in project root
        env_file_encoding='utf-8',
        extra='ignore'
    )

settings = Settings()

# Verwijderde "FINAL SETTINGS CHECK" 