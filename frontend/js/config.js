const _isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
// Opened by a bare IP address or a .local name (e.g. a phone testing against a
// dev machine on the same Wi-Fi): use the dev server's same-origin /api proxy,
// which forwards to that machine's local backend. Deployed sites are always
// reached by domain name, so this never applies to them.
// See frontend-build/dev-server.py.
const _isLan = /^\d{1,3}(\.\d{1,3}){3}$/.test(location.hostname) || location.hostname.endsWith('.local');
export const API_BASE = _isLocal
    ? 'http://localhost:8000'
    : _isLan
    ? `${location.origin}/api`
    : 'https://cap-portal-api.onrender.com';

// Set to true to enable a dev login button that bypasses wallet auth.
// Never enable in production.
export const DEV_MODE = false;

export const APP_ID = 'cap-portal-v2';
