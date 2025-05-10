import os
from functools import lru_cache
from typing import Optional
import traceback

from .core.config import settings, RetrieverType

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

@lru_cache() # Cache de runner instance
def get_storm_runner() -> Optional[STORMWikiRunner]:
    if not STORM_DEPENDENCIES_AVAILABLE:
        print("Storm dependencies not available.")
        return None
    
    openai_key = settings.OPENAI_API_KEY.get_secret_value() if settings.OPENAI_API_KEY else None
    if not openai_key:
        print("ERROR: OPENAI_API_KEY not set in environment. Cannot initialize Storm LM.")
        return None

    try:
        # 1. Configureer LMs
        lm_configs = STORMWikiLMConfigs()
        base_openai_kwargs = {
            "api_key": openai_key,
            "temperature": 1.0,
            "top_p": 0.9,
        }
        
        ModelClass = OpenAIModel
        model_specific_kwargs = base_openai_kwargs.copy()

        if settings.OPENAI_API_TYPE == "azure":
            ModelClass = AzureOpenAIModel
            if not settings.AZURE_API_BASE or not settings.AZURE_API_VERSION:
                print("ERROR: AZURE_API_BASE and AZURE_API_VERSION must be set for Azure API type.")
                return None
            
            model_specific_kwargs["azure_endpoint"] = settings.AZURE_API_BASE
            model_specific_kwargs["api_version"] = settings.AZURE_API_VERSION

            gpt_35_model_name = settings.GPT_35_MODEL_NAME_AZURE if settings.GPT_35_MODEL_NAME_AZURE else "gpt-4o-mini"
            gpt_4_model_name = settings.GPT_4_MODEL_NAME_AZURE if settings.GPT_4_MODEL_NAME_AZURE else "gpt-4o"
            
            print(f"--- AZURE OpenAI Configuration ---")
            print(f"Using AzureOpenAIModel")
            print(f"Azure Endpoint: {settings.AZURE_API_BASE}")
            print(f"API Version: {settings.AZURE_API_VERSION}")
            print(f"GPT-3.5 class model name (deployment): {gpt_35_model_name}")
            print(f"GPT-4 class model name (deployment): {gpt_4_model_name}")
            print(f"----------------------------------")
        else: # OpenAI
            gpt_35_model_name = "gpt-3.5-turbo"
            gpt_4_model_name = settings.GPT_4_MODEL_NAME if settings.GPT_4_MODEL_NAME else "gpt-4o"
            print(f"--- OpenAI (Non-Azure) Configuration ---")
            print(f"Using OpenAIModel")
            print(f"GPT-3.5 class model name: {gpt_35_model_name}")
            print(f"GPT-4 class model name: {gpt_4_model_name}")
            print(f"--------------------------------------")
        
        # Modellen initialiseren
        print(f"Initializing conv_simulator_lm with model: {gpt_35_model_name} and kwargs: {model_specific_kwargs}")
        conv_simulator_lm = ModelClass(model=gpt_35_model_name, max_tokens=500, **model_specific_kwargs)
        print(f"Initializing question_asker_lm with model: {gpt_35_model_name} and kwargs: {model_specific_kwargs}")
        question_asker_lm = ModelClass(model=gpt_35_model_name, max_tokens=500, **model_specific_kwargs)
        print(f"Initializing outline_gen_lm with model: {gpt_4_model_name} and kwargs: {model_specific_kwargs}")
        outline_gen_lm = ModelClass(model=gpt_4_model_name, max_tokens=400, **model_specific_kwargs)
        print(f"Initializing article_gen_lm with model: {gpt_4_model_name} and kwargs: {model_specific_kwargs}")
        article_gen_lm = ModelClass(model=gpt_4_model_name, max_tokens=700, **model_specific_kwargs)
        print(f"Initializing article_polish_lm with model: {gpt_4_model_name} and kwargs: {model_specific_kwargs}")
        article_polish_lm = ModelClass(model=gpt_4_model_name, max_tokens=4000, **model_specific_kwargs)

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
            api_key = settings.TAVILY_API_KEY.get_secret_value() if settings.TAVILY_API_KEY else None
            if not api_key: raise ValueError("TAVILY_API_KEY not set for 'tavily' retriever")
            rm = TavilySearchRM(tavily_search_api_key=api_key, k=engine_args.search_top_k, include_raw_content=True)
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