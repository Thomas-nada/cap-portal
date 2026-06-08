#!/bin/sh
set -e

_cfg="${CONFIG_FILE:-}"

# Read a key from the JSON config file if present, otherwise return empty.
_get() {
  if [ -n "$_cfg" ] && [ -f "$_cfg" ]; then
    jq -r --arg key "$1" '.[$key] // empty' "$_cfg"
  fi
}

# Write config.js from the current config file (or env vars as fallback).
_write_config() {
  _api_base="$(_get API_BASE)"
  _api_base="${_api_base:-${API_BASE:-/api}}"

  cat > /usr/share/nginx/html/js/config.js << EOF
export const API_BASE = '${_api_base}';
export const DEV_MODE = false;
export const APP_ID = 'cap-portal-v2';
EOF
}

# Write initial config.
_write_config

# If a config file is in use, poll it every 10 seconds and regenerate
# config.js whenever its contents change — no pod restart needed.
if [ -n "$_cfg" ]; then
  (
    _last="$(md5sum "$_cfg" 2>/dev/null || true)"
    while true; do
      sleep 10
      _current="$(md5sum "$_cfg" 2>/dev/null || true)"
      if [ -n "$_current" ] && [ "$_current" != "$_last" ]; then
        _write_config
        _last="$_current"
      fi
    done
  ) &
fi

exec "$@"
