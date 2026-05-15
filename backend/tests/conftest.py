import sys
import os

# Ensure the backend directory is on the path so imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Must be set before any app import
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ["RATELIMIT_ENABLED"] = "0"  # disable slowapi rate limiting in tests
