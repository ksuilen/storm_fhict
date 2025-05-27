# backend/app/test_version_check.py
import os
import sys

# Set environment for testing
os.environ['APP_ENV'] = 'docker'

# Add paths
sys.path.insert(0, '/app')

def test_current_version():
    """Test which STORM version is currently active"""
    
    print("=" * 50)
    print("🔍 STORM VERSION CHECK")
    print("=" * 50)
    
    try:
        # Import the factory
        from app.storm_runner import get_storm_runner
        from app.core.config import settings
        
        print(f"Environment STORM_RUNNER_VERSION: {settings.STORM_RUNNER_VERSION}")
        
        # Try to get a runner
        print("\nTrying to get STORM runner...")
        runner = get_storm_runner()
        
        if runner:
            print(f"✅ Runner initialized successfully!")
            print(f"   Runner type: {type(runner)}")
            print(f"   Module: {runner.__class__.__module__}")
            
            # Check which version is being used based on the module path
            if '/app/external/storm' in runner.__class__.__module__:
                print("🚀 Using V2 (Repository version)")
            else:
                print("📦 Using V1 (Pip package)")
                
        else:
            print("❌ Failed to initialize runner")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    print("=" * 50)

if __name__ == "__main__":
    test_current_version() 