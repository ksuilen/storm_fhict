# backend/app/test_storm_import.py
import sys
from pathlib import Path

# Add STORM repository to path
STORM_PATH = Path("/app/external/storm")
if str(STORM_PATH) not in sys.path:
    sys.path.insert(0, str(STORM_PATH))

try:
    from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
    print("✅ Core STORM imports successful")
except ImportError as e:
    print(f"❌ Core STORM imports failed: {e}")

try:
    from knowledge_storm.lm import OpenAIModel, AzureOpenAIModel, LitellmModel
    print("✅ LM imports successful")
except ImportError as e:
    print(f"❌ LM imports failed: {e}")

try:
    from knowledge_storm.rm import YouRM, BingSearch, TavilySearchRM
    print("✅ RM imports successful")
except ImportError as e:
    print(f"❌ RM imports failed: {e}")

print("STORM path:", STORM_PATH)
print("Path exists:", STORM_PATH.exists())
print("Resolved path:", STORM_PATH.resolve())
print("Current working directory:", Path.cwd())
print("__file__ location:", Path(__file__).resolve())
print("Python path:", sys.path[:3])  # Show first 3 entries 