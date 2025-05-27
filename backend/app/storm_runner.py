import os
from typing import Optional, Union, Any
import traceback

from .core.config import settings, RetrieverType
from .database import get_db, SessionLocal
from . import crud, models

# Probeer Storm componenten te importeren
try:
    from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
    from knowledge_storm.lm import OpenAIModel, AzureOpenAIModel
    from knowledge_storm.rm import (
        YouRM, BingSearch, BraveRM, SerperRM, DuckDuckGoSearchRM, TavilySearchRM, SearXNG, AzureAISearch
    )
    STORM_DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    print(f"WARNING: Failed to import Storm dependencies: {e}. Storm functionality will be disabled.")
    # Zet alle types op None zodat de rest van de code niet crasht bij type hinting
    STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs = None, None, None
    OpenAIModel, AzureOpenAIModel = None, None
    YouRM, BingSearch, BraveRM, SerperRM, DuckDuckGoSearchRM, TavilySearchRM, SearXNG, AzureAISearch = None, None, None, None, None, None, None, None
    STORM_DEPENDENCIES_AVAILABLE = False

# Helper functie om een waarde uit admin_config te halen, anders uit settings, anders None
def get_effective_value(
    admin_config: Optional[models.SystemConfiguration],
    admin_key: str,
    settings_obj: Any, # settings object (Pydantic BaseSettings instance)
    settings_key: str,
    is_secret: bool = False
) -> Optional[Union[str, bool, int]]: # Uitbreiden met andere types indien nodig
    # print(f"DEBUG GET_EFFECTIVE_VALUE: Trying for admin_key='{admin_key}', settings_key='{settings_key}'")
    if admin_config and hasattr(admin_config, admin_key):
        admin_val = getattr(admin_config, admin_key)
        # print(f"DEBUG GET_EFFECTIVE_VALUE: Found admin_key '{admin_key}'. Value: '{admin_val if not is_secret else ('******' if admin_val else 'None/Empty')}', Type: {type(admin_val)}")
        if admin_val is not None and admin_val != '': # Lege string uit admin telt als 'niet gezet'
            # print(f"DEBUG GET_EFFECTIVE_VALUE: Using admin value for '{admin_key}'")
            return admin_val
        # else:
            # print(f"DEBUG GET_EFFECTIVE_VALUE: Admin value for '{admin_key}' is None or empty, falling back.")
    # else:
        # if not admin_config:
            # print(f"DEBUG GET_EFFECTIVE_VALUE: admin_config is None.")
        # elif not hasattr(admin_config, admin_key):
            # print(f"DEBUG GET_EFFECTIVE_VALUE: admin_config does not have attribute '{admin_key}'. Available attributes: {dir(admin_config)}")
    
    # Fallback naar Pydantic settings (omgeving/default)
    # print(f"DEBUG GET_EFFECTIVE_VALUE: Attempting fallback to Pydantic settings for '{settings_key}'")
    if hasattr(settings_obj, settings_key):
        settings_val = getattr(settings_obj, settings_key)
        if is_secret and settings_val is not None and hasattr(settings_val, 'get_secret_value'):
            secret_value = settings_val.get_secret_value()
            # print(f"DEBUG GET_EFFECTIVE_VALUE: Using Pydantic SecretStr for '{settings_key}'. Has value: {bool(secret_value)}")
            return secret_value
        elif not is_secret and settings_val is not None:
            # print(f"DEBUG GET_EFFECTIVE_VALUE: Using Pydantic value for '{settings_key}': '{settings_val}'")
            return settings_val
        # else:
            # print(f"DEBUG GET_EFFECTIVE_VALUE: Pydantic value for '{settings_key}' is None or (if secret) not a SecretStr with value.")
    # else:
        # print(f"DEBUG GET_EFFECTIVE_VALUE: settings_obj does not have attribute '{settings_key}'.")

    # print(f"DEBUG GET_EFFECTIVE_VALUE: No value found for admin_key='{admin_key}' / settings_key='{settings_key}'. Returning None.")
    return None

# @lru_cache() # Cache de runner instance. Verwijderd zodat admin wijzigingen direct effect hebben.
def get_storm_runner_v1() -> Optional[STORMWikiRunner]:
    if not STORM_DEPENDENCIES_AVAILABLE:
        print("Storm dependencies not available.")
        return None
    
    # --- Configuratie laden: Admin DB -> Pydantic Settings (env) -> Pydantic Defaults ---
    db_for_config: Optional[SessionLocal] = None
    admin_config: Optional[models.SystemConfiguration] = None # models is nodig
    try:
        # Een DB sessie verkrijgen binnen een gecachte, niet-request-gebonden functie is lastig.
        # Dit is een poging, maar kan problemen geven afhankelijk van de get_db implementatie
        # en hoe de sessie gesloten wordt. Een robuustere oplossing zou zijn om de
        # configuratie bij het opstarten van de app te laden en door te geven, of de cache te verwijderen.
        db_generator = get_db()
        db_for_config = next(db_generator)
        admin_config = crud.get_system_configuration(db_for_config)
    except Exception as e:
        print(f"WARNING: Could not fetch admin configuration from DB during get_storm_runner: {e}. Using environment defaults.")
        # traceback.print_exc() # Kan nuttig zijn voor debuggen
        admin_config = None
    finally:
        if db_for_config and 'db_generator' in locals(): # Zorg dat db_generator bestaat
            try:
                next(db_generator) # Poging om de generator af te sluiten zoals FastAPI dat doet
            except StopIteration:
                pass # Normaal gedrag
            except Exception as e_close:
                print(f"Warning: Exception while closing DB session in get_storm_runner: {e_close}")

    # API Key blijft altijd uit Pydantic settings (omgeving)
    # print(f"DEBUG STORM_RUNNER: Admin config object before get_effective_value for API key: {admin_config}")
    # if admin_config:
        # print(f"DEBUG STORM_RUNNER: Attributes of admin_config: {dir(admin_config)}")
        # if hasattr(admin_config, 'openai_api_key'):
            # print(f"DEBUG STORM_RUNNER: admin_config.openai_api_key value: '{getattr(admin_config, 'openai_api_key', 'NOT_FOUND')}'")
        # else:
            # print("DEBUG STORM_RUNNER: admin_config does NOT have openai_api_key attribute.")

    effective_openai_api_key = get_effective_value(admin_config, 'openai_api_key', settings, 'OPENAI_API_KEY', is_secret=True)
    # print(f"DEBUG STORM_RUNNER: effective_openai_api_key after get_effective_value: '{effective_openai_api_key if effective_openai_api_key else "None/Empty"}'")

    effective_openai_api_type = get_effective_value(admin_config, 'openai_api_type', settings, 'OPENAI_API_TYPE') or 'openai'
    if not effective_openai_api_key:
        print("ERROR: OPENAI_API_KEY not set in environment. Cannot initialize Storm LM.")
        return None

    # Bepaal effectieve configuratiewaarden
    effective_small_model_name = admin_config.small_model_name if admin_config and admin_config.small_model_name else settings.SMALL_MODEL_NAME
    effective_large_model_name = admin_config.large_model_name if admin_config and admin_config.large_model_name else settings.LARGE_MODEL_NAME
    effective_small_model_name_azure = admin_config.small_model_name_azure if admin_config and admin_config.small_model_name_azure else settings.SMALL_MODEL_NAME_AZURE
    effective_large_model_name_azure = admin_config.large_model_name_azure if admin_config and admin_config.large_model_name_azure else settings.LARGE_MODEL_NAME_AZURE
    effective_azure_api_base = admin_config.azure_api_base if admin_config and admin_config.azure_api_base else settings.AZURE_API_BASE
    # Nieuw: effective_openai_api_base
    effective_openai_api_base = admin_config.openai_api_base if admin_config and hasattr(admin_config, 'openai_api_base') and admin_config.openai_api_base else settings.OPENAI_API_BASE
    # AZURE_API_VERSION blijft uit Pydantic settings (omgeving)
    effective_azure_api_version = settings.AZURE_API_VERSION

    if admin_config:
        print("--- Loaded configuration includes Admin Settings (DB) overrides where applicable ---")
    else:
        print("--- Using default configuration from Pydantic settings (environment/defaults) ---")

    try:
        # 1. Configureer LMs
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
            
            print(f"--- AZURE OpenAI Configuration (Effective) ---")
            print(f"Using AzureOpenAIModel")
            print(f"Azure Endpoint: {effective_azure_api_base}")
            print(f"API Version: {effective_azure_api_version}")
            print(f"Small model name (deployment): {small_model_name}")
            print(f"Large model name (deployment): {large_model_name}")
            print(f"----------------------------------")
        else: # OpenAI
            small_model_name = effective_small_model_name
            large_model_name = effective_large_model_name
            print(f"--- OpenAI (Non-Azure) Configuration (Effective) ---")
            print(f"Using OpenAIModel")
            if effective_openai_api_base:
                model_specific_kwargs["api_base"] = effective_openai_api_base
                print(f"OpenAI API Base URL (Effective): {effective_openai_api_base}")
            print(f"Small model name: {small_model_name}")
            print(f"Large model name: {large_model_name}")
            print(f"--------------------------------------")
        
        # Modellen initialiseren
        print(f"Initializing conv_simulator_lm with model: {small_model_name} and kwargs: {model_specific_kwargs}")
        conv_simulator_lm = ModelClass(model=small_model_name, max_tokens=500, **model_specific_kwargs)
        print(f"Initializing question_asker_lm with model: {small_model_name} and kwargs: {model_specific_kwargs}")
        question_asker_lm = ModelClass(model=small_model_name, max_tokens=500, **model_specific_kwargs)
        print(f"Initializing outline_gen_lm with model: {large_model_name} and kwargs: {model_specific_kwargs}")
        outline_gen_lm = ModelClass(model=large_model_name, max_tokens=400, **model_specific_kwargs)
        print(f"Initializing article_gen_lm with model: {large_model_name} and kwargs: {model_specific_kwargs}")
        article_gen_lm = ModelClass(model=large_model_name, max_tokens=700, **model_specific_kwargs)
        print(f"Initializing article_polish_lm with model: {large_model_name} and kwargs: {model_specific_kwargs}")
        article_polish_lm = ModelClass(model=large_model_name, max_tokens=4000, **model_specific_kwargs)

        lm_configs.set_conv_simulator_lm(conv_simulator_lm)
        lm_configs.set_question_asker_lm(question_asker_lm)
        lm_configs.set_outline_gen_lm(outline_gen_lm)
        lm_configs.set_article_gen_lm(article_gen_lm)
        lm_configs.set_article_polish_lm(article_polish_lm)

        # 2. Configureer Engine Args
        output_dir = settings.STORM_OUTPUT_DIR
        os.makedirs(output_dir, exist_ok=True)
        engine_args = STORMWikiRunnerArguments(
            output_dir=output_dir,
            max_conv_turn=settings.STORM_MAX_CONV_TURN,
            max_perspective=settings.STORM_MAX_PERSPECTIVE,
            search_top_k=settings.STORM_SEARCH_TOP_K,
            max_thread_num=settings.STORM_MAX_THREAD_NUM,
        )

        # 3. Configureer Retriever (RM)
        retriever_choice: RetrieverType = settings.STORM_RETRIEVER
        rm = None
        print(f"Attempting to initialize retriever: {retriever_choice}")

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
            # print(f"DEBUG STORM_RUNNER: Initializing Tavily. Admin config: {admin_config is not None}")
            # if admin_config and hasattr(admin_config, 'tavily_api_key'):
                # print(f"DEBUG STORM_RUNNER: admin_config.tavily_api_key value before get_effective_value: '{getattr(admin_config, 'tavily_api_key', 'NOT_FOUND')}'")
            # elif admin_config:
                # print("DEBUG STORM_RUNNER: admin_config does NOT have tavily_api_key attribute.")
            # else:
                # print("DEBUG STORM_RUNNER: admin_config is None, cannot check for tavily_api_key attribute.")

            effective_tavily_key = get_effective_value(admin_config, 'tavily_api_key', settings, 'TAVILY_API_KEY', is_secret=True)
            # print(f"DEBUG STORM_RUNNER: effective_tavily_key for Tavily AFTER get_effective_value: '{effective_tavily_key if effective_tavily_key else "None/Empty"}'")
            
            if not effective_tavily_key: raise ValueError("TAVILY_API_KEY not set (Admin DB or Pydantic/env) for 'tavily' retriever")
            rm = TavilySearchRM(tavily_search_api_key=effective_tavily_key, k=engine_args.search_top_k, include_raw_content=True)
            print(f"TavilyRM initialized using effective key.") # Schonere log
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

        # 4. Initialiseer Runner
        runner = STORMWikiRunner(engine_args, lm_configs, rm)
        print("STORMWikiRunner initialized successfully (LMs, RM, EngineArgs).")
        return runner

    except Exception as e:
        print(f"ERROR: Failed to initialize STORMWikiRunner during LM setup: {e}")
        traceback.print_exc()
        return None

    try: # Nieuwe try-except specifiek voor RM en Runner init
        # ... (Engine Args configuratie) ...
        # ... (Retriever (RM) configuratie) ...
        # ... (Runner initialisatie) ...
        # (bestaande code voor engine_args, rm, en runner initialisatie hier)
        output_dir = settings.STORM_OUTPUT_DIR
        os.makedirs(output_dir, exist_ok=True)
        engine_args = STORMWikiRunnerArguments(
            output_dir=output_dir,
            max_conv_turn=settings.STORM_MAX_CONV_TURN,
            max_perspective=settings.STORM_MAX_PERSPECTIVE,
            search_top_k=settings.STORM_SEARCH_TOP_K,
            max_thread_num=settings.STORM_MAX_THREAD_NUM,
        )
        retriever_choice: RetrieverType = settings.STORM_RETRIEVER
        rm = None
        print(f"Attempting to initialize retriever: {retriever_choice}")
        # ... (je bestaande if/elif blok voor retrievers) ...
        if retriever_choice == "you":
            api_key_val = settings.YDC_API_KEY.get_secret_value() if settings.YDC_API_KEY else None
            if not api_key_val: raise ValueError("YDC_API_KEY not set for 'you' retriever")
            rm = YouRM(ydc_api_key=api_key_val, k=engine_args.search_top_k)
        elif retriever_choice == "tavily": # Voorbeeld, voeg andere toe zoals je had
            api_key_val = settings.TAVILY_API_KEY.get_secret_value() if settings.TAVILY_API_KEY else None
            if not api_key_val: raise ValueError("TAVILY_API_KEY not set for 'tavily' retriever")
            rm = TavilySearchRM(tavily_search_api_key=api_key_val, k=engine_args.search_top_k, include_raw_content=True)
        else:
            raise ValueError(f"Invalid or unhandled retriever configured: {retriever_choice}")

        if rm is None:
             raise ValueError(f"Failed to initialize retriever: {retriever_choice}")

        runner = STORMWikiRunner(engine_args, lm_configs, rm)
        print("STORMWikiRunner initialized successfully (LMs, RM, EngineArgs).")
        return runner

    except Exception as e:
        print(f"ERROR: Failed to initialize STORMWikiRunner during RM/Engine setup: {e}")
        traceback.print_exc()
        return None

def get_storm_runner() -> Optional[STORMWikiRunner]:
    """Smart factory that chooses runner version based on configuration"""
    runner_version = settings.STORM_RUNNER_VERSION
    
    if runner_version == 'v2':
        try:
            from .storm_runner_v2 import get_storm_runner_v2
            print("🔄 Using STORM V2 (repository version)")
            return get_storm_runner_v2()
        except ImportError as e:
            print(f"⚠️ STORM V2 not available, falling back to V1: {e}")
            runner_version = 'v1'
        except Exception as e:
            print(f"⚠️ STORM V2 failed to initialize, falling back to V1: {e}")
            runner_version = 'v1'
    
    if runner_version == 'v1':
        print("🔄 Using STORM V1 (pip package)")
        return get_storm_runner_v1()
    
    print(f"❌ Unknown STORM runner version: {runner_version}")
    return None 