# backend/app/test_factory.py
import os
import sys
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

# Set up the module path for relative imports
sys.path.insert(0, '/app')

from app.storm_runner import get_storm_runner
from app.core.config import settings

def test_factory():
    """Test the STORM runner factory with different versions"""
    
    print("=" * 60)
    print("🧪 TESTING STORM RUNNER FACTORY")
    print("=" * 60)
    
    # Test current configuration
    print(f"Current STORM_RUNNER_VERSION: {settings.STORM_RUNNER_VERSION}")
    print(f"Environment APP_ENV: {settings.APP_ENV}")
    
    # Test V1
    print("\n" + "─" * 40)
    print("🔍 Testing V1 (pip package)")
    print("─" * 40)
    
    # Temporarily set to V1
    original_version = settings.STORM_RUNNER_VERSION
    settings.STORM_RUNNER_VERSION = "v1"
    
    try:
        runner_v1 = get_storm_runner()
        if runner_v1:
            print("✅ V1 Runner initialized successfully!")
            print(f"   Type: {type(runner_v1)}")
        else:
            print("❌ V1 Runner failed to initialize")
    except Exception as e:
        print(f"❌ V1 Runner error: {e}")
    
    # Test V2
    print("\n" + "─" * 40)
    print("🔍 Testing V2 (repository)")
    print("─" * 40)
    
    # Set to V2
    settings.STORM_RUNNER_VERSION = "v2"
    
    try:
        runner_v2 = get_storm_runner()
        if runner_v2:
            print("✅ V2 Runner initialized successfully!")
            print(f"   Type: {type(runner_v2)}")
        else:
            print("❌ V2 Runner failed to initialize")
    except Exception as e:
        print(f"❌ V2 Runner error: {e}")
    
    # Restore original version
    settings.STORM_RUNNER_VERSION = original_version
    
    print("\n" + "=" * 60)
    print("🏁 FACTORY TEST COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    test_factory() 