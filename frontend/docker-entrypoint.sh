#!/bin/sh
set -e

# Write runtime JS config from environment variables.
cat > /usr/share/nginx/html/js/config.js << EOF
export const API_BASE = '${API_BASE:-/api}';
export const DEV_MODE = false;
export const APP_ID = 'cap-portal-v2';
EOF

exec "$@"
