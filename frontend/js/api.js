import { API_BASE } from './config.js';

function getToken() {
    return localStorage.getItem('cap_token');
}

async function req(method, path, body = null, auth = false) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (auth || token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) throw new Error('AUTH_EXPIRED');
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
    }
    if (res.status === 204) return null;
    return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function getChallenge() {
    return req('GET', '/auth/challenge');
}

export async function verifyAuth(payload) {
    return req('POST', '/auth/verify', payload);
}

export async function getMe() {
    return req('GET', '/auth/me', null, true);
}

export async function setDisplayName(display_name) {
    return req('POST', '/auth/set-name', { display_name }, true);
}

export async function updateProfile(display_name, email = null, notification_prefs = null) {
    return req('PATCH', '/auth/profile', { display_name, email, notification_prefs }, true);
}

// Dev-only: seed an editor without auth
export async function devSeedEditor(stake_address, display_name) {
    return req('POST', '/dev/seed-editor', { stake_address, display_name });
}

// ── Proposals ─────────────────────────────────────────────────────────────────

export async function fetchAllProposals() {
    return req('GET', '/proposals');
}

export async function fetchProposal(number) {
    return req('GET', `/proposals/${number}`);
}

export async function createProposal(data) {
    return req('POST', '/proposals', data, true);
}

export async function updateProposal(number, data) {
    return req('PATCH', `/proposals/${number}`, data, true);
}

export async function generateDraftConstitution(number) {
    return req('POST', `/proposals/${number}/generate-draft-constitution`, {}, true);
}

// ── Labels ────────────────────────────────────────────────────────────────────

export async function addLabel(number, name) {
    return req('POST', `/proposals/${number}/labels`, { name }, true);
}

export async function removeLabel(number, name) {
    return req('DELETE', `/proposals/${number}/labels/${encodeURIComponent(name)}`, null, true);
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function fetchComments(number) {
    return req('GET', `/proposals/${number}/comments`);
}

export async function createComment(number, body) {
    return req('POST', `/proposals/${number}/comments`, { body }, true);
}

export async function updateComment(id, body) {
    return req('PATCH', `/comments/${id}`, { body }, true);
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export async function fetchAudit(number) {
    return req('GET', `/proposals/${number}/audit`);
}

// ── Constitution ──────────────────────────────────────────────────────────────

export async function fetchConstitutionVersions() {
    return req('GET', '/constitution');
}

export async function fetchConstitutionContent(filename) {
    return req('GET', `/constitution/${encodeURIComponent(filename)}`);
}

// ── Editors ───────────────────────────────────────────────────────────────────

export async function fetchEditors() {
    return req('GET', '/editors');
}

export async function addEditor(stake_address, display_name) {
    return req('POST', '/editors', { stake_address, display_name }, true);
}

export async function removeEditor(stake_address) {
    return req('DELETE', `/editors/${encodeURIComponent(stake_address)}`, null, true);
}

export async function claimFirstEditor() {
    return req('POST', '/editors/bootstrap', {}, true);
}

// ── Admins ────────────────────────────────────────────────────────────────────

export async function fetchAdmins() {
    return req('GET', '/admins');
}

export async function addAdmin(stake_address, display_name) {
    return req('POST', '/admins', { stake_address, display_name }, true);
}

export async function removeAdmin(stake_address) {
    return req('DELETE', `/admins/${encodeURIComponent(stake_address)}`, null, true);
}

export async function claimFirstAdmin() {
    return req('POST', '/admins/bootstrap', {}, true);
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export async function subscribeToProposal(number, email) {
    return req('POST', `/proposals/${number}/subscribe`, { email });
}

export async function checkSubscription(number, email) {
    return req('GET', `/proposals/${number}/subscribe?email=${encodeURIComponent(email)}`);
}

export async function unsubscribeFromProposal(number, email) {
    return req('DELETE', `/proposals/${number}/subscribe`, { email });
}

// ── Versions ──────────────────────────────────────────────────────────────────

export async function fetchVersions(number) {
    return req('GET', `/proposals/${number}/versions`);
}

export async function fetchVersion(number, version) {
    return req('GET', `/proposals/${number}/versions/${version}`);
}

// ── Suggestions ───────────────────────────────────────────────────────────────

export async function fetchSuggestions(number) {
    return req('GET', `/proposals/${number}/suggestions`);
}

export async function createSuggestion(number, field, suggested_value, reason) {
    return req('POST', `/proposals/${number}/suggestions`, { field, suggested_value, reason }, true);
}

export async function approveSuggestion(number, id) {
    return req('POST', `/proposals/${number}/suggestions/${id}/approve`, {}, true);
}

export async function rejectSuggestion(number, id) {
    return req('POST', `/proposals/${number}/suggestions/${id}/reject`, {}, true);
}
