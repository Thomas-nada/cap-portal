const _isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
export const API_BASE = _isLocal
    ? 'http://localhost:8000'
    : 'https://cap-portal-api.onrender.com';

// Set to true to enable a dev login button that bypasses wallet auth.
// Never enable in production.
export const DEV_MODE = false;

export const APP_ID = 'cap-portal-v2';
