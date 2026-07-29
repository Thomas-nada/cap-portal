const _isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
export const API_BASE = _isLocal
    ? 'http://localhost:8000'
    : 'https://cap-portal-api-test.onrender.com';

// True on the disposable test/demo deployment (and locally), false on the live
// production site. Test-only features — e.g. the Feedback page — key off this so
// they never surface on production even if the code is present.
export const IS_TEST = _isLocal
    || location.hostname.includes('test')
    || API_BASE.includes('-test');

// Set to true to enable a dev login button that bypasses wallet auth.
// Never enable in production.
export const DEV_MODE = false;

export const APP_ID = 'cap-portal-v2-test';
