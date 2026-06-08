"""
Runtime config loader.

Reads from a JSON file each time a value is requested so that secrets
managed by the Keeper sidecar can be updated in place without a pod restart.
Falls back to environment variables if the file is absent or the key is missing.
"""
import json
import logging
import os

logger = logging.getLogger(__name__)

def get(key: str, default: str = None) -> str:
    config_file = os.environ.get("CONFIG_FILE")
    if config_file and os.path.isfile(config_file):
        try:
            with open(config_file) as f:
                data = json.load(f)
            if key in data:
                return str(data[key])
        except Exception as e:
            logger.warning("[config] Failed to read %s: %s", config_file, e)
    return os.environ.get(key, default)
