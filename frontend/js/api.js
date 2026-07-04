import { API_BASE } from './config.js';

function getToken() {
    return localStorage.getItem('cap_token');
}

async function req(method, path, body = null, auth = false) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

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

export async function updateProfile(display_name) {
    return req('PATCH', '/auth/profile', { display_name }, true);
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

// ── Withdrawal ────────────────────────────────────────────────────────────────

export async function withdrawProposal(number) {
    return req('POST', `/proposals/${number}/withdraw`, {}, true);
}

export async function cancelWithdrawal(number) {
    return req('POST', `/proposals/${number}/withdraw/cancel`, {}, true);
}

// ── Moderation ────────────────────────────────────────────────────────────────

export async function flagProposal(number, reason) {
    return req('POST', `/proposals/${number}/flag`, { reason }, true);
}

export async function flagComment(commentId, reason) {
    return req('POST', `/comments/${commentId}/flag`, { reason }, true);
}

export async function fetchModerationCases(status = 'open') {
    return req('GET', `/moderation/cases?status=${encodeURIComponent(status)}`, null, true);
}

export async function moderationRemove(caseId, reason) {
    return req('POST', `/moderation/cases/${caseId}/remove`, { reason }, true);
}

export async function moderationReject(caseId, reason) {
    return req('POST', `/moderation/cases/${caseId}/reject`, { reason }, true);
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function fetchNotifications() {
    return req('GET', '/notifications', null, true);
}

export async function fetchUnreadCount() {
    return req('GET', '/notifications/unread-count', null, true);
}

export async function markNotificationRead(id) {
    return req('POST', `/notifications/${id}/read`, {}, true);
}

export async function markAllNotificationsRead() {
    return req('POST', '/notifications/read-all', {}, true);
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

// ── Bug Reports ───────────────────────────────────────────────────────────────

export async function submitBugReport(title, description, screenshot = null, environment = null) {
    return req('POST', '/bug-reports', { title, description, screenshot, environment }, true);
}

export async function fetchBugReports() {
    return req('GET', '/bug-reports', null, true);
}

export async function updateBugStatus(id, status) {
    return req('PATCH', `/bug-reports/${id}/status`, { status }, true);
}

// ── Guides ────────────────────────────────────────────────────────────────────

export async function fetchGuides() {
    return req('GET', '/guides');
}

export async function fetchGuide(slug) {
    return req('GET', `/guides/${encodeURIComponent(slug)}`);
}

export async function upsertGuide(slug, title, content, section = 'general', section_label = null, sort_order = 0) {
    return req('PUT', `/guides/${encodeURIComponent(slug)}`, { title, content, section, section_label, sort_order }, true);
}

export async function deleteGuide(slug) {
    return req('DELETE', `/guides/${encodeURIComponent(slug)}`, null, true);
}
