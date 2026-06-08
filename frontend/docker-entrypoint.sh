#!/bin/sh
set -e

# If a JSON config file is provided (e.g. via Keeper Secrets sidecar),
# extract values from it. Falls back to environment variables if the file
# is absent or a key is not present in it.
_cfg="${CONFIG_FILE:-}"
_get() {
  if [ -n "$_cfg" ] && [ -f "$_cfg" ]; then
    jq -r --arg key "$1" '.[$key] // empty' "$_cfg"
  fi
}

_api_base="$(_get API_BASE)"
API_BASE="${_api_base:-${API_BASE:-/api}}"

# Write runtime JS config.
cat > /usr/share/nginx/html/js/config.js << EOF
export const API_BASE = '${API_BASE}';
export const DEV_MODE = false;
export const APP_ID = 'cap-portal-v2';
EOF

exec "$@"
