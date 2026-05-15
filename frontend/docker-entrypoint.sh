#!/bin/sh
set -e

# Write runtime JS config from environment variables.
# API_BASE defaults to /api (nginx reverse proxy — used in docker-compose).
# On Render, API_BASE is set to the full backend URL (e.g. https://cap-portal-api.onrender.com).
cat > /usr/share/nginx/html/js/config.js << EOF
export const API_BASE = '${API_BASE:-/api}';
export const DEV_MODE = false;
export const APP_ID = 'cap-portal-v2';
EOF

# Prepend https:// if API_BASE is a bare hostname (Render sets host without scheme)
if echo "${API_BASE}" | grep -qvE '^https?://|^/'; then
  API_BASE="https://${API_BASE}"
fi

# If API_BASE is a full URL (Render deployment), nginx doesn't need to proxy —
# the browser calls the backend directly. Replace the proxy_pass target so the
# /api/ location still resolves cleanly (points nowhere harmful).
# If API_BASE is /api (docker-compose), keep the default http://backend:8000/ target.
if echo "${API_BASE}" | grep -qE '^https?://'; then
  # Full URL mode: point nginx proxy at the same URL (strips /api prefix as before)
  BACKEND_PROXY="${API_BASE}"
  sed -i "s|http://backend:8000/|${BACKEND_PROXY}/|g" /etc/nginx/conf.d/default.conf
fi

exec "$@"
