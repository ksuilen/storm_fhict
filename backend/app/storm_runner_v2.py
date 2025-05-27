# backend/app/storm_runner_v2.py
import os
import sys
from pathlib import Path
from typing import Optional, Union, Any
import traceback

# Add STORM repository to Python path
STORM_PATH = Path("/app/external/storm")
if str(STORM_PATH) not in sys.path:
    sys.path.insert(0, str(STORM_PATH))

from .core.config import settings, RetrieverType
from .database import get_db, SessionLocal
from . import crud, models

# Import from local STORM repository
try:
    from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
    from knowledge_storm.lm import OpenAIModel, AzureOpenAIModel
    from knowledge_storm.rm import (
        YouRM, BingSearch, BraveRM, SerperRM, DuckDuckGoSearchRM, TavilySearchRM, SearXNG, AzureAISearch
    )
    STORM_V2_AVAILABLE = True
    print("✅ STORM V2 (repository) dependencies loaded successfully")
except ImportError as e:
    print(f"❌ Failed to import STORM V2 dependencies: {e}")
    # Set all types to None so the rest of the code doesn't crash on type hinting
    STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs = None, None, None
    OpenAIModel, AzureOpenAIModel = None, None
    YouRM, BingSearch, BraveRM, SerperRM, DuckDuckGoSearchRM, TavilySearchRM, SearXNG, AzureAISearch = None, None, None, None, None, None, None, None
    STORM_V2_AVAILABLE = False

# Helper function to get a value from admin_config, otherwise from settings, otherwise None
# (Reusing the same logic as V1 for consistency)
def get_effective_value(
    admin_config: Optional[models.SystemConfiguration],
    admin_key: str,
    settings_obj: Any,
    settings_key: str,
    is_secret: bool = False
) -> Optional[Union[str, bool, int]]:
    if admin_config and hasattr(admin_config, admin_key):
        admin_val = getattr(admin_config, admin_key)
        if admin_val is not None and admin_val != '':
            return admin_val
    
    # Fallback to Pydantic settings (environment/default)
    if hasattr(settings_obj, settings_key):
        settings_val = getattr(settings_obj, settings_key)
        if is_secret and settings_val is not None and hasattr(settings_val, 'get_secret_value'):
            return settings_val.get_secret_value()
        elif not is_secret and settings_val is not None:
            return settings_val
    
    return None

def get_storm_runner_v2() -> Optional[STORMWikiRunner]:
    """
    Initialize STORM runner using the repository version for deep customization
    """
    if not STORM_V2_AVAILABLE:
        print("❌ STORM V2 dependencies not available")
        return None
    
    print("🚀 Initializing STORM V2 (repository version)")
    
    # --- Configuration loading: Admin DB -> Pydantic Settings (env) -> Pydantic Defaults ---
    db_for_config: Optional[SessionLocal] = None
    admin_config: Optional[models.SystemConfiguration] = None
    try:
        db_generator = get_db()
        db_for_config = next(db_generator)
        admin_config = crud.get_system_configuration(db_for_config)
    except Exception as e:
        print(f"WARNING: Could not fetch admin configuration from DB during get_storm_runner_v2: {e}. Using environment defaults.")
        admin_config = None
    finally:
        if db_for_config and 'db_generator' in locals():
            try:
                next(db_generator)
            except StopIteration:
                pass
            except Exception as e_close:
                print(f"Warning: Exception while closing DB session in get_storm_runner_v2: {e_close}")

    # Get effective configuration values
    effective_openai_api_key = get_effective_value(admin_config, 'openai_api_key', settings, 'OPENAI_API_KEY', is_secret=True)
    effective_openai_api_type = get_effective_value(admin_config, 'openai_api_type', settings, 'OPENAI_API_TYPE') or 'openai'
    
    if not effective_openai_api_key:
        print("ERROR: OPENAI_API_KEY not set in environment. Cannot initialize Storm LM V2.")
        return None

    # Determine effective configuration values
    effective_small_model_name = admin_config.small_model_name if admin_config and admin_config.small_model_name else settings.SMALL_MODEL_NAME
    effective_large_model_name = admin_config.large_model_name if admin_config and admin_config.large_model_name else settings.LARGE_MODEL_NAME
    effective_small_model_name_azure = admin_config.small_model_name_azure if admin_config and admin_config.small_model_name_azure else settings.SMALL_MODEL_NAME_AZURE
    effective_large_model_name_azure = admin_config.large_model_name_azure if admin_config and admin_config.large_model_name_azure else settings.LARGE_MODEL_NAME_AZURE
    effective_azure_api_base = admin_config.azure_api_base if admin_config and admin_config.azure_api_base else settings.AZURE_API_BASE
    effective_openai_api_base = admin_config.openai_api_base if admin_config and hasattr(admin_config, 'openai_api_base') and admin_config.openai_api_base else settings.OPENAI_API_BASE
    effective_azure_api_version = settings.AZURE_API_VERSION

    if admin_config:
        print("--- V2: Loaded configuration includes Admin Settings (DB) overrides where applicable ---")
    else:
        print("--- V2: Using default configuration from Pydantic settings (environment/defaults) ---")

    try:
        # 1. Configure LMs
        lm_configs = STORMWikiLMConfigs()
        base_openai_kwargs = {
            "api_key": effective_openai_api_key,
            "temperature": 1.0,
            "top_p": 0.9,
        }
        
        ModelClass = OpenAIModel
        model_specific_kwargs = base_openai_kwargs.copy()

        if effective_openai_api_type == "azure":
            ModelClass = AzureOpenAIModel
            if not effective_azure_api_base or not effective_azure_api_version:
                print("ERROR: Effective AZURE_API_BASE and AZURE_API_VERSION must be set for Azure API type.")
                return None
            
            model_specific_kwargs["azure_endpoint"] = effective_azure_api_base
            model_specific_kwargs["api_version"] = effective_azure_api_version

            small_model_name = effective_small_model_name_azure
            large_model_name = effective_large_model_name_azure
            
            print(f"--- V2 AZURE OpenAI Configuration (Effective) ---")
            print(f"Using AzureOpenAIModel")
            print(f"Azure Endpoint: {effective_azure_api_base}")
            print(f"API Version: {effective_azure_api_version}")
            print(f"Small model name (deployment): {small_model_name}")
            print(f"Large model name (deployment): {large_model_name}")
            print(f"----------------------------------")
        else: # OpenAI
            small_model_name = effective_small_model_name
            large_model_name = effective_large_model_name
            print(f"--- V2 OpenAI (Non-Azure) Configuration (Effective) ---")
            print(f"Using OpenAIModel")
            if effective_openai_api_base:
                model_specific_kwargs["api_base"] = effective_openai_api_base
                print(f"OpenAI API Base URL (Effective): {effective_openai_api_base}")
            print(f"Small model name: {small_model_name}")
            print(f"Large model name: {large_model_name}")
            print(f"--------------------------------------")
        
        # Initialize models
        print(f"V2: Initializing conv_simulator_lm with model: {small_model_name}")
        conv_simulator_lm = ModelClass(model=small_model_name, max_tokens=500, **model_specific_kwargs)
        print(f"V2: Initializing question_asker_lm with model: {small_model_name}")
        question_asker_lm = ModelClass(model=small_model_name, max_tokens=500, **model_specific_kwargs)
        print(f"V2: Initializing outline_gen_lm with model: {large_model_name}")
        outline_gen_lm = ModelClass(model=large_model_name, max_tokens=400, **model_specific_kwargs)
        print(f"V2: Initializing article_gen_lm with model: {large_model_name}")
        article_gen_lm = ModelClass(model=large_model_name, max_tokens=700, **model_specific_kwargs)
        print(f"V2: Initializing article_polish_lm with model: {large_model_name}")
        article_polish_lm = ModelClass(model=large_model_name, max_tokens=4000, **model_specific_kwargs)

        lm_configs.set_conv_simulator_lm(conv_simulator_lm)
        lm_configs.set_question_asker_lm(question_asker_lm)
        lm_configs.set_outline_gen_lm(outline_gen_lm)
        lm_configs.set_article_gen_lm(article_gen_lm)
        lm_configs.set_article_polish_lm(article_polish_lm)

        # 2. Configure Engine Args
        output_dir = settings.STORM_OUTPUT_DIR
        os.makedirs(output_dir, exist_ok=True)
        engine_args = STORMWikiRunnerArguments(
            output_dir=output_dir,
            max_conv_turn=settings.STORM_MAX_CONV_TURN,
            max_perspective=settings.STORM_MAX_PERSPECTIVE,
            search_top_k=settings.STORM_SEARCH_TOP_K,
            max_thread_num=settings.STORM_MAX_THREAD_NUM,
        )

        # 3. Configure Retriever (RM)
        retriever_choice: RetrieverType = settings.STORM_RETRIEVER
        rm = None
        print(f"V2: Attempting to initialize retriever: {retriever_choice}")

        if retriever_choice == "you":
            api_key_val = settings.YDC_API_KEY.get_secret_value() if settings.YDC_API_KEY else None
            if not api_key_val: raise ValueError("YDC_API_KEY not set for 'you' retriever")
            rm = YouRM(ydc_api_key=api_key_val, k=engine_args.search_top_k)
        elif retriever_choice == "bing":
            api_key = settings.BING_SEARCH_API_KEY.get_secret_value() if settings.BING_SEARCH_API_KEY else None
            if not api_key: raise ValueError("BING_SEARCH_API_KEY not set for 'bing' retriever")
            rm = BingSearch(bing_search_api=api_key, k=engine_args.search_top_k)
        elif retriever_choice == "brave":
            api_key = settings.BRAVE_API_KEY.get_secret_value() if settings.BRAVE_API_KEY else None
            if not api_key: raise ValueError("BRAVE_API_KEY not set for 'brave' retriever")
            rm = BraveRM(brave_search_api_key=api_key, k=engine_args.search_top_k)
        elif retriever_choice == "duckduckgo":
            rm = DuckDuckGoSearchRM(k=engine_args.search_top_k, safe_search="On", region="us-en")
        elif retriever_choice == "serper":
            api_key = settings.SERPER_API_KEY.get_secret_value() if settings.SERPER_API_KEY else None
            if not api_key: raise ValueError("SERPER_API_KEY not set for 'serper' retriever")
            rm = SerperRM(serper_search_api_key=api_key, query_params={"autocorrect": True, "num": 10, "page": 1})
        elif retriever_choice == "tavily":
            effective_tavily_key = get_effective_value(admin_config, 'tavily_api_key', settings, 'TAVILY_API_KEY', is_secret=True)
            if not effective_tavily_key: raise ValueError("TAVILY_API_KEY not set (Admin DB or Pydantic/env) for 'tavily' retriever")
            rm = TavilySearchRM(tavily_search_api_key=effective_tavily_key, k=engine_args.search_top_k, include_raw_content=True)
            print(f"V2: TavilyRM initialized using effective key.")
        elif retriever_choice == "searxng":
            api_key = settings.SEARXNG_API_KEY.get_secret_value() if settings.SEARXNG_API_KEY else None
            if not api_key: raise ValueError("SEARXNG_API_KEY not set for 'searxng' retriever")
            rm = SearXNG(searxng_api_key=api_key, k=engine_args.search_top_k)
        elif retriever_choice == "azure_ai_search":
            api_key_val = settings.AZURE_AI_SEARCH_API_KEY.get_secret_value() if settings.AZURE_AI_SEARCH_API_KEY else None
            if not api_key_val: raise ValueError("AZURE_AI_SEARCH_API_KEY not set for 'azure_ai_search' retriever")
            rm = AzureAISearch(azure_ai_search_api_key=api_key_val, k=engine_args.search_top_k)
        else:
            raise ValueError(f"Invalid retriever configured: {retriever_choice}")

        if rm is None:
             raise ValueError(f"Failed to initialize retriever: {retriever_choice}")

        # 4. Initialize Runner
        runner = STORMWikiRunner(engine_args, lm_configs, rm)
        print("✅ STORMWikiRunner V2 (repository version) initialized successfully!")
        print(f"🔧 STORM source code available at: {STORM_PATH}")
        print(f"🚀 Ready for deep customizations!")
        return runner

    except Exception as e:
        print(f"❌ ERROR: Failed to initialize STORMWikiRunner V2: {e}")
        traceback.print_exc()
        return None 