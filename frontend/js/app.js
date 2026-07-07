import { fetchAllProposals, fetchProposal, fetchComments, fetchAudit,
         createProposal, updateProposal, addLabel, removeLabel,
         withdrawProposal, cancelWithdrawal,
         createComment, updateComment,
         flagProposal, flagComment, fetchModerationCases, moderationRemove, moderationReject,
         fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead,
         fetchConstitutionVersions, fetchConstitutionContent,
         fetchEditors, addEditor, removeEditor, claimFirstEditor,
         fetchAdmins, addAdmin, removeAdmin, claimFirstAdmin,
         fetchSuggestions, createSuggestion, approveSuggestion, rejectSuggestion,
         fetchVersions, fetchVersion,
         getMe, devSeedEditor, setDisplayName, updateProfile, acceptAlphaAgreement,
         generateDraftConstitution,
         submitBugReport, fetchBugReports, updateBugStatus,
         fetchGuides, fetchGuide, upsertGuide, deleteGuide } from './api.js';

import { connectAndAuth, logout, getSavedSession, renderWalletModal,
         showDisplayNameStep, devLogin, shortAddress,
         getAvailableWallets } from './wallet.js';

import { DEV_MODE, API_BASE } from './config.js';
import { computeStageCounts } from './lifecycle.js';

import { renderNav }          from './components/nav.js';
import { renderDashboard }    from './components/dashboard.js';
import { renderRegistry }     from './components/registry.js';
import { renderKanban }       from './components/kanban.js';
import { renderDetail }       from './components/detail.js';
import { renderWizard, validateStep, isStepSkipped } from './components/wizard.js';
import { renderEdit }         from './components/edit.js';
import { renderConstitution } from './components/constitution.js';
import { renderLearnHub as renderLearn } from './components/learn.js';
import { renderEditors }      from './components/editors.js';
import { renderModeration }   from './components/moderation.js';
import { renderBugs }         from './components/bugs.js';

// ── Global state ──────────────────────────────────────────────────────────────

export const state = {
    // Auth
    user: null,           // {stake_address, display_name, is_editor, is_admin}
    // Data
    proposals: [],
    currentProposal: null,
    comments: [],
    auditEvents: [],
    editors: [],
    admins: [],
    bugReports: [],
    moderationCases: [],
    moderationFilter: 'open',
    notifications: [],
    notificationsOpen: false,
    unreadCount: 0,
    suggestions: [],
    proposalVersions: [],
    constitutionVersions: [],        // [{name, filename, isCurrent, content}]
    constitutionCurrentVersion: null, // version name string
    constitutionCompareVersion: null, // version name string or null
    // UI
    view: 'dashboard',
    loading: { init: true, proposals: false, proposal: false },
    error: null,
    auditPanelExpanded: true,
    mobileNavOpen: false,
    // Filters
    kanbanSearch: '',
    registrySearch: '',
    statusFilter: 'open',
    docTypeFilter: 'ALL',
    kanbanTagPanelOpen: false,
    // Wizard
    wizardData: {},
    wizardStep: 1,
    wizardError: null,
    wizardSubmitted: null,
    // Edit
    editingProposal: null,
    // Learn
    activeGuide: null,
    guideHtml: null,
    guideRawContent: null,
    guideLastEditor: null,
    guideLastUpdated: null,
    guides: [],
    guidesLoaded: false,
    // Stats (derived)
    stats: { consultation: 0, ready: 0, done: 0 },
};

window.state = state;

// ── Keep-alive ping (prevents Render free tier spin-down) ─────────────────────
setInterval(() => fetch(`${API_BASE}/health`).catch(() => {}), 10 * 60 * 1000);

// ── Rendering ─────────────────────────────────────────────────────────────────

export function updateUI(rerender = false) {
    const root = document.getElementById('app');
    if (!root) return;

    const nav = renderNav(state);
    let content = '';

    switch (state.view) {
        case 'dashboard':    content = renderDashboard(state); break;
        case 'list':         content = renderRegistry(state); break;
        case 'kanban':       content = renderKanban(state); break;
        case 'detail':       content = renderDetail(state); break;
        case 'wizard':       content = renderWizard(state); break;
        case 'edit':         content = renderEdit(state); break;
        case 'constitution': content = renderConstitution(state); break;
        case 'learn':        content = renderLearn(state); break;
        case 'editors':      content = renderEditors(state); break;
        case 'moderation':   content = renderModeration(state); break;
        case 'bugs':         content = renderBugs(state); break;
        default:             content = renderDashboard(state);
    }

    const alphaBanner = `
        <div class="bg-red-600 text-white text-center text-xs sm:text-sm font-semibold px-4 py-2">
            This is an alpha version currently in testing.
            <button onclick="window.showAlphaInfo()" class="underline underline-offset-2 font-bold ml-1 hover:text-white/80">Read more</button>
        </div>`;

    const notif = state.notificationsOpen ? renderNotificationsPanel() : '';
    const errorToast = state.error ? `
        <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 max-w-lg px-5 py-4 rounded-2xl bg-red-600 text-white shadow-2xl">
 <i data-lucide="alert-triangle" class="w-5 h-5 flex-shrink-0 mt-0.5"></i>
 <p class="text-sm font-semibold leading-snug">${escapeHtmlGlobal(state.error)}</p>
            <button onclick="window.dismissError()" class="flex-shrink-0 hover:bg-white/20 rounded-lg p-1 -m-1 transition-colors">
 <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>` : '';

    // The wizard is a focused, full-page flow: no app nav or footer — just the
    // logo (→ home) and a Discard (step 1) / Back (later steps) control.
    if (state.view === 'wizard') {
        const step = state.wizardStep || 1;
        const rightBtn = state.wizardSubmitted ? '' : (step > 1
            ? `<button onclick="window.wizardPrevStep()" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"><i data-lucide="arrow-left" class="w-4 h-4"></i> Back</button>`
            : `<button onclick="window.wizardExit()" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"><i data-lucide="x" class="w-4 h-4"></i> Discard</button>`);
        root.innerHTML = alphaBanner + `
            <div class="bg-white/90 border-b border-white/20">
                <div class="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <button onclick="window.wizardExit()" class="flex items-center gap-3">
                        <img src="CAP.png" alt="CAP Portal" class="w-9 h-9 object-contain">
                        <div class="text-left leading-none">
                            <span class="block font-semibold text-slate-900">CAP Portal</span>
                            <span class="block text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Constitutional Amendments</span>
                        </div>
                    </button>
                    ${rightBtn}
                </div>
            </div>
 <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">${content}</main>
        ` + notif + errorToast;
        lucide.createIcons();
        if (window.fixPreCode) window.fixPreCode();
        return;
    }

    root.innerHTML = alphaBanner + nav + `
 <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            ${content}
        </main>
        <footer class="mt-16 bg-[#0228aa] border-t border-white/10">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-8">
                <div class="flex flex-col gap-0">
                    <img src="intersect-logo.png" alt="Intersect" class="w-48 h-auto -ml-5">
                    <p class="text-xs text-white/50 -mt-3">&copy; ${new Date().getFullYear()} Intersect. All Rights Reserved.</p>
                </div>
                <nav class="flex flex-col gap-1">
                    <p class="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Links</p>
                    <a href="https://intersectmbo.org" target="_blank" rel="noopener noreferrer" class="text-sm text-white/70 hover:text-white transition-colors">Home</a>
                    <a onclick="window.setView('editors')" class="text-sm text-white/70 hover:text-white transition-colors cursor-pointer">Editors</a>
                    <a href="https://docs.intersectmbo.org/intersect-knowledge-base/legal/policies-and-conditions/intersect-internal-policies/terms-of-use" target="_blank" rel="noopener noreferrer" class="text-sm text-white/70 hover:text-white transition-colors">Terms of Use</a>
                    <a href="https://docs.intersectmbo.org/intersect-knowledge-base/legal/policies-and-conditions/intersect-internal-policies/privacy-policy" target="_blank" rel="noopener noreferrer" class="text-sm text-white/70 hover:text-white transition-colors">Privacy Policy</a>
                </nav>
                <div class="flex flex-col gap-2">
                    <p class="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Follow us</p>
                    <a href="https://x.com/intersectmbo" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        X
                    </a>
                    <a href="https://www.linkedin.com/company/intersectmbo/" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        LinkedIn
                    </a>
                </div>
            </div>
        </footer>
        ${state.user ? `
        <button onclick="window.openBugReportModal()" title="Report a bug"
 class="fixed bottom-6 right-6 z-40 w-14 h-14 bg-red-500 hover:bg-red-600 active:scale-95 text-white rounded-full shadow-xl flex items-center justify-center transition-all">
 <i data-lucide="bug" class="w-6 h-6"></i>
        </button>` : ''}
        ${notif}
        ${errorToast}`;

    lucide.createIcons();
    if (window.fixPreCode) window.fixPreCode();
}

window.updateUI = updateUI;

function escapeHtmlGlobal(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function timeAgoShort(iso) {
    if (!iso) return '';
    const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(iso).toLocaleDateString();
}

const NOTIF_ICON = {
    flag_pending: { icon: 'flag', color: 'text-amber-600 bg-amber-100' },
    under_review: { icon: 'eye-off', color: 'text-amber-600 bg-amber-100' },
    removed:      { icon: 'ban', color: 'text-red-600 bg-red-100' },
    reinstated:   { icon: 'check-circle', color: 'text-green-600 bg-green-100' },
};

function renderNotificationsPanel() {
    const list = state.notifications || [];
    return `
    <div onclick="if(event.target===this) window.toggleNotifications()"
         class="fixed inset-0 z-[55] flex justify-end sm:justify-center sm:items-start">
      <div class="mt-24 mr-6 sm:mr-0 w-full max-w-sm bg-white rounded-[2rem] border border-slate-100 shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 class="text-sm font-black text-slate-900">Notifications</h3>
          <button onclick="window.toggleNotifications()" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="max-h-[60vh] overflow-y-auto">
          ${list.length === 0 ? `
          <div class="p-10 text-center text-slate-400">
            <i data-lucide="bell-off" class="w-8 h-8 mx-auto mb-3 opacity-40"></i>
            <p class="text-xs font-bold">No notifications yet.</p>
          </div>` : list.map(n => {
            const ic = NOTIF_ICON[n.type] || { icon: 'bell', color: 'text-slate-500 bg-slate-100' };
            return `
            <button onclick="window.notificationGoTo(${n.id}, ${n.proposal_number == null ? 'null' : n.proposal_number})"
              class="w-full text-left flex gap-3 px-5 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${n.read ? '' : 'bg-blue-50/40'}">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ic.color}">
                <i data-lucide="${ic.icon}" class="w-4 h-4"></i>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-bold text-slate-900 leading-snug">${escapeHtmlGlobal(n.title)}</p>
                ${n.body ? `<p class="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap leading-snug">${escapeHtmlGlobal(n.body)}</p>` : ''}
                <p class="text-[10px] text-slate-400 font-bold mt-1">${timeAgoShort(n.created_at)}</p>
              </div>
              ${n.read ? '' : '<span class="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0 mt-2"></span>'}
            </button>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

window.dismissError = () => {
    state.error = null;
    updateUI();
};

// ── Navigation ────────────────────────────────────────────────────────────────

window.setView = (view) => {
    state.view = view;
    state.mobileNavOpen = false;
    state.wizardSubmitted = null;  // never leave a stale success screen
    window.dismissWizardCommitToast?.();  // drop any wizard step-2 toast on navigation
    const map = {
        dashboard: '#/home', list: '#/proposals', kanban: '#/board',
        constitution: '#/constitution',
        wizard: '#/wizard', learn: '#/guides', editors: '#/editors', moderation: '#/moderation', bugs: '#/bugs',
    };
    if (map[view]) window.location.hash = map[view];
    updateUI();
};

window.toggleMobileNav = () => {
    state.mobileNavOpen = !state.mobileNavOpen;
    updateUI();
};

window.handleRouting = async () => {
    const hash = window.location.hash || '#/home';
    if (hash && !hash.startsWith('#/')) return; // in-page anchor (e.g. constitution "Jump To" links) — let the browser scroll, don't reroute
    state.error = null;

    if (hash === '#/home' || hash === '#/') {
        state.view = 'dashboard';
        loadProposals();
    } else if (hash === '#/proposals' || hash === '#/registry') {
        state.view = 'list';
        loadProposals();
    } else if (hash === '#/board' || hash === '#/kanban') {
        state.view = 'kanban';
        loadProposals();
    } else if (hash === '#/constitution') {
        state.view = 'constitution';
        loadConstitution();
    } else if (hash === '#/wizard') {
        state.view = 'wizard';
        updateUI();
    } else if (hash.startsWith('#/detail/')) {
        const number = parseInt(hash.split('/').pop());
        openProposal(number, false);
    } else if (hash.startsWith('#/edit/')) {
        const number = parseInt(hash.split('/').pop());
        if (state.view === 'edit' && state.currentProposal?.number === number) {
            updateUI();
        } else {
            openProposal(number, false).then(() => {
                state.view = 'edit';
                updateUI();
            });
        }
    } else if (hash.startsWith('#/guides/') || hash.startsWith('#/learn/')) {
        const slug = hash.replace('#/guides/', '').replace('#/learn/', '');
        state.view = 'learn';
        if (slug) {
            if (!state.guidesLoaded) loadGuides().then(() => window.openGuide(slug));
            else window.openGuide(slug);
        } else {
            if (!state.guidesLoaded) loadGuides();
            else updateUI();
        }
    } else if (hash === '#/guides' || hash === '#/learn') {
        state.view = 'learn';
        state.activeGuide = null;
        state.guideHtml = null;
        state.guideRawContent = null;
        state.guideLastEditor = null;
        state.guideLastUpdated = null;
        if (!state.guidesLoaded) loadGuides();
        else updateUI();
    } else if (hash === '#/editors') {
        state.view = 'editors';
        loadEditors();
    } else if (hash === '#/moderation') {
        state.view = 'moderation';
        loadModerationCases();
    } else if (hash === '#/bugs') {
        state.view = 'bugs';
        loadBugReports();
    } else {
        state.view = 'dashboard';
        loadProposals();
    }
};

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadEditors() {
    try {
        const [editors, admins] = await Promise.all([fetchEditors(), fetchAdmins()]);
        state.editors = editors;
        state.admins = admins;
    } catch (e) {
        state.editors = [];
        state.admins = [];
    }
    updateUI();
}

async function loadModerationCases() {
    if (!state.user?.is_admin) { state.moderationCases = []; updateUI(); return; }
    state.loading = { ...state.loading, moderation: true };
    updateUI();
    try {
        state.moderationCases = await fetchModerationCases(state.moderationFilter || 'open');
    } catch (e) {
        state.moderationCases = [];
        state.error = e.message;
    } finally {
        state.loading = { ...state.loading, moderation: false };
        updateUI();
    }
}

window.setModerationFilter = (f) => {
    state.moderationFilter = f;
    loadModerationCases();
};

window.moderationResolve = (caseId, decision) => {
    if (!state.user?.is_admin) return;
    const isRemove = decision === 'remove';
    openReasonModal({
        title: isRemove ? 'Remove flagged content' : 'Reject removal request',
        intro: isRemove
            ? 'The content stays hidden (visible to admins only) and is not deleted. The author and the flagging editor are notified.'
            : 'The content becomes visible again. The author and the flagging editor are notified.',
        label: 'Your reasoning',
        placeholder: isRemove ? 'Explain why this is being removed…' : 'Explain why this is being kept…',
        confirmText: isRemove ? 'Remove' : 'Reject & Restore',
        confirmClass: isRemove ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700',
        onSubmit: async (reason) => {
            if (isRemove) await moderationRemove(caseId, reason);
            else await moderationReject(caseId, reason);
            await loadModerationCases();
            refreshUnreadCount();
        },
    });
};

// ── Notifications ─────────────────────────────────────────────────────────────

async function refreshUnreadCount() {
    if (!state.user) { state.unreadCount = 0; return; }
    try {
        const { count } = await fetchUnreadCount();
        state.unreadCount = count;
        updateUI();
    } catch { /* ignore */ }
}
window.refreshUnreadCount = refreshUnreadCount;

window.toggleNotifications = async () => {
    state.notificationsOpen = !state.notificationsOpen;
    updateUI();
    if (state.notificationsOpen && state.user) {
        try {
            state.notifications = await fetchNotifications();
            updateUI();
            // Mark all read once opened.
            if (state.unreadCount > 0) {
                await markAllNotificationsRead();
                state.unreadCount = 0;
                state.notifications = state.notifications.map(n => ({ ...n, read: true }));
                updateUI();
            }
        } catch (e) { state.error = e.message; updateUI(); }
    }
};

window.notificationGoTo = async (id, proposalNumber) => {
    state.notificationsOpen = false;
    try { await markNotificationRead(id); } catch {}
    if (proposalNumber != null) window.openProposal(proposalNumber);
    else updateUI();
};

async function loadBugReports() {
    try {
        state.bugReports = await fetchBugReports();
    } catch (e) {
        state.bugReports = [];
    }
    updateUI();
}

async function loadGuides() {
    try {
        state.guides = await fetchGuides();
        state.guidesLoaded = true;
    } catch {
        state.guides = [];
        state.guidesLoaded = true;
    }
    updateUI();
}

async function loadProposals() {
    state.loading.proposals = true;
    updateUI();
    try {
        const ps = await fetchAllProposals();
        state.proposals = ps;
        computeStats();
    } catch (e) {
        state.error = e.message;
    } finally {
        state.loading.proposals = false;
        updateUI();
    }
}

function computeStats() {
    // Same staging + set (CAP and CIS) the board and registry use.
    state.stats = computeStageCounts(state.proposals);
}

async function loadConstitution() {
    // Always land on the current version, never a stale diff selection left
    // over from a previous visit (e.g. comparing a proposal's draft, or a
    // manually-enabled diff view) — diff mode is opt-in per visit only.
    state.constitutionCompareVersion = null;
    try {
        if (!state.constitutionVersions.length) {
            const raw = await fetchConstitutionVersions();
            state.constitutionVersions = raw.map((v, i) => ({
                name: v.display_name || v.filename.replace('.md', ''),
                filename: v.filename,
                isCurrent: i === 0,
                content: null,
            }));
        }
        if (state.constitutionVersions.length && !state.constitutionCurrentVersion) {
            state.constitutionCurrentVersion = state.constitutionVersions[0].name;
        }
        const cur = state.constitutionVersions.find(v => v.name === state.constitutionCurrentVersion);
        if (cur && !cur.content) {
            const data = await fetchConstitutionContent(cur.filename);
            cur.content = data.content;
        }
    } catch (e) {
        state.error = e.message;
    }
    updateUI();
}

async function loadConstitutionVersionByName(name) {
    const v = state.constitutionVersions.find(v => v.name === name);
    if (!v) return;
    if (!v.content) {
        const data = await fetchConstitutionContent(v.filename);
        v.content = data.content;
    }
}

// Loads the current constitution (once) for the reader embedded in wizard Step 2.
window.ensureConstitutionForWizard = () => {
    const cur = (state.constitutionVersions || []).find(v => v.name === state.constitutionCurrentVersion)
              || (state.constitutionVersions || [])[0];
    if (cur && cur.content) return;
    if (state._wizardConstLoading) return;
    state._wizardConstLoading = true;
    loadConstitution().finally(() => { state._wizardConstLoading = false; });
};

window.switchConstitutionVersion = async (name) => {
    state.constitutionCurrentVersion = name;
    state.constitutionCompareVersion = null;
    try { await loadConstitutionVersionByName(name); } catch (e) { state.error = e.message; }
    updateUI();
};

window.reloadConstitution = () => {
    state.constitutionVersions = [];
    state.constitutionCurrentVersion = null;
    state.constitutionCompareVersion = null;
    loadConstitution();
};

window.downloadConstitution = () => {
    const cur = state.constitutionVersions.find(v => v.name === state.constitutionCurrentVersion);
    if (!cur?.content) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([cur.content], { type: 'text/plain' }));
    a.download = `${cur.name}.txt`;
    a.click();
};

window.enableDiffMode = async () => {
    const others = state.constitutionVersions.filter(v => v.name !== state.constitutionCurrentVersion);
    if (!others.length) return;
    state.constitutionCompareVersion = others[0].name;
    try { await loadConstitutionVersionByName(others[0].name); } catch (e) { state.error = e.message; }
    updateUI();
};

window.disableDiffMode = () => {
    state.constitutionCompareVersion = null;
    updateUI();
};

window.setCompareVersion = async (name) => {
    state.constitutionCompareVersion = name;
    try { await loadConstitutionVersionByName(name); } catch (e) { state.error = e.message; }
    updateUI();
};

// ── Proposal actions ──────────────────────────────────────────────────────────

window.openProposal = async (number, addToHistory = true) => {
    state.loading.proposal = true;
    state.view = 'detail';
    updateUI();
    try {
        const [proposal, comments, audit, suggestions, versions] = await Promise.all([
            fetchProposal(number),
            fetchComments(number),
            fetchAudit(number),
            fetchSuggestions(number),
            fetchVersions(number),
        ]);
        state.currentProposal = proposal;
        state.comments = comments;
        state.auditEvents = audit;
        state.suggestions = suggestions;
        state.proposalVersions = versions;
        if (addToHistory) window.location.hash = `#/detail/${number}`;
    } catch (e) {
        // The proposal is missing or hidden (under review / removed) for this
        // viewer. Clear any stale copy so it can't linger on screen, and send
        // the user to the registry rather than an empty detail shell.
        state.currentProposal = null;
        state.comments = [];
        state.auditEvents = [];
        state.suggestions = [];
        state.proposalVersions = [];
        state.error = 'That proposal is not available.';
        state.view = 'list';
        history.replaceState(null, '', '#/proposals');
        if (!state.proposals.length) { loadProposals(); return; }
    } finally {
        state.loading.proposal = false;
        updateUI();
    }
};

window.submitWizard = async () => {
    if (!state.user) { showWalletModal(); return; }
    const w = state.wizardData;
    const title = (w.title || '').trim();
    if (!title) { state.error = 'Title is required'; updateUI(); return; }
    const structured = {
        type: w.type || 'CAP',
        category: w.category || '',
        abstract: w.abstract || '',
        motivation: w.motivation || '',
        analysis: w.analysis || '',
        impact: w.impact || '',
        exhibits: w.exhibits || '',
        revisions: (w.selectedText || []).map((sel, i) => sel.kind === 'add_after'
            ? { type: 'addition', insert_after: sel.text || '', proposed: (w.revisions || {})[i] || '', section: sel.sectionId || '' }
            : { original: sel.text || '', proposed: (w.revisions || {})[i] || '', section: sel.sectionId || '' }
        ),
        co_authors: w.coAuthors ? [w.coAuthors] : [],
    };
    // Disable the button + show a loader so a slow request can't be double-clicked.
    state.loading = { ...state.loading, submitting: true };
    updateUI();
    try {
        const proposal = await createProposal({ title, type: w.type || 'CAP', structured });
        await addLabel(proposal.number, proposal.type);
        if (w.category) await addLabel(proposal.number, w.category);
        // Generate draft constitution if proposal includes revisions
        const hasRevisions = structured.revisions?.some(r => (r.original && r.proposed) || (r.insert_after && r.proposed));
        if (hasRevisions) {
            try {
                await generateDraftConstitution(proposal.number);
                state.constitutionVersions = []; // force refetch so the new draft shows up
                state.constitutionCurrentVersion = null;
            } catch (_) {}
        }
        state.wizardData = {};
        state.wizardStep = 1;
        state.loading = { ...state.loading, submitting: false };
        state.wizardSubmitted = proposal.number;  // shows the success screen
        updateUI();
    } catch (e) {
        state.error = e.message;
        state.loading = { ...state.loading, submitting: false };
        updateUI();
    }
};

// Success-screen actions.
window.wizardViewSubmitted = (number) => {
    state.wizardSubmitted = null;
    window.openProposal(number);
};
window.wizardCreateAnother = () => {
    state.wizardSubmitted = null;
    state.wizardData = {};
    state.wizardStep = 1;
    updateUI();
};

window.postComment = async (formOrNumber, bodyArg) => {
    if (!state.user) { showWalletModal(); return; }
    let number, body;
    if (formOrNumber instanceof HTMLElement) {
        const fd = new FormData(formOrNumber);
        body = fd.get('body') || formOrNumber.querySelector('textarea')?.value || '';
        number = state.currentProposal?.number;
        formOrNumber.reset();
    } else {
        number = formOrNumber;
        body = bodyArg;
    }
    if (!body?.trim() || !number) return;
    state.loading = { ...state.loading, postComment: true };
    updateUI();
    try {
        const comment = await createComment(number, body);
        state.comments = [...state.comments, comment];
    } catch (e) {
        state.error = e.message;
    } finally {
        state.loading = { ...state.loading, postComment: false };
        updateUI();
    }
};

// ── Admin management ──────────────────────────────────────────────────────────

window.claimAdminRole = async () => {
    if (!state.user) return;
    try {
        await claimFirstAdmin();
        state.user = { ...state.user, is_admin: true };
        const [editors, admins] = await Promise.all([fetchEditors(), fetchAdmins()]);
        state.editors = editors;
        state.admins = admins;
        updateUI();
    } catch (e) {
        alert(e.message);
    }
};

window.submitAddAdmin = async () => {
    const addrEl = document.getElementById('new-admin-addr');
    const errEl  = document.getElementById('add-admin-error');
    const addr = addrEl?.value.trim();
    if (!addr) { if (errEl) { errEl.textContent = 'Stake address is required.'; errEl.classList.remove('hidden'); } return; }
    try {
        if (errEl) errEl.classList.add('hidden');
        await addAdmin(addr, null);
        state.admins = await fetchAdmins();
        if (addrEl) addrEl.value = '';
        updateUI();
    } catch (e) {
        if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
    }
};

window.removeAdminConfirm = async (stakeAddress, displayName) => {
    if (!confirm(`Remove ${displayName} as an admin?`)) return;
    try {
        await removeAdmin(stakeAddress);
        state.admins = await fetchAdmins();
        updateUI();
    } catch (e) {
        alert(e.message);
    }
};

// ── Editor management ─────────────────────────────────────────────────────────

window.submitAddEditor = async () => {
    const addrEl = document.getElementById('new-editor-addr');
    const errEl  = document.getElementById('add-editor-error');
    const addr = addrEl?.value.trim();
    if (!addr) { if (errEl) { errEl.textContent = 'Stake address is required.'; errEl.classList.remove('hidden'); } return; }
    try {
        if (errEl) errEl.classList.add('hidden');
        await addEditor(addr, null);
        state.editors = await fetchEditors();
        if (addrEl) addrEl.value = '';
        updateUI();
    } catch (e) {
        if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
    }
};

window.removeEditorConfirm = async (stakeAddress, displayName) => {
    if (!confirm(`Remove ${displayName} as an editor?`)) return;
    try {
        await removeEditor(stakeAddress);
        state.editors = await fetchEditors();
        updateUI();
    } catch (e) {
        alert(e.message);
    }
};

// ── Version history ───────────────────────────────────────────────────────────

// Word-level diff — returns HTML string with diff-del / diff-ins marks
function versionWordDiff(oldStr, newStr) {
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const tok = s => s.match(/\S+|\s+/g) || [];
    const O = tok(oldStr), N = tok(newStr);
    const m = O.length, n = N.length;
    const dp = Array.from({length: m+1}, () => new Int32Array(n+1));
    for (let i = m-1; i >= 0; i--)
        for (let j = n-1; j >= 0; j--)
            dp[i][j] = O[i] === N[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j], dp[i][j+1]);
    let html = '', i = 0, j = 0;
    while (i < m || j < n) {
        if (i < m && j < n && O[i] === N[j]) { html += esc(O[i++]); j++; }
        else if (j < n && (i >= m || dp[i][j+1] >= dp[i+1][j]))
 html += `<mark class="diff-ins">${esc(N[j++])}</mark>`;
 else html += `<mark class="diff-del">${esc(O[i++])}</mark>`;
    }
    return html;
}

window.openVersionModal = async (number, version) => {
    const existing = document.getElementById('version-modal-backdrop');
    if (existing) existing.remove();

    const esc = str => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const renderMd = text => window.safeMarkdown(text);

    try {
        const fetches = [fetchVersion(number, version)];
        if (version > 1) fetches.push(fetchVersion(number, version - 1));
        const [v, prev] = await Promise.all(fetches);

        const s = v.structured || {};
        const isCIS = s.type === 'CIS';
        const sp = prev?.structured || {};

        const when = new Date(v.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

        // Render revisions the same way as the proposal detail
        const renderRevisions = (revisions) => {
            if (!revisions?.length) return '';
            return revisions.map(r => r.type === 'addition' ? `
 <div class="rounded-2xl border border-cyan-100 overflow-hidden mb-4">
 ${r.section ? `<div class="px-5 py-2 bg-cyan-50 text-xs font-black text-cyan-500 uppercase tracking-widest">${esc(r.section)}</div>` : ''}
 <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-cyan-100 ">
 <div class="p-5"><div class="text-[10px] font-black uppercase tracking-widest text-cyan-500 mb-2">Insert After</div>
 <div class="text-sm text-slate-600 font-mono leading-relaxed italic">${esc(r.insert_after || '')}</div></div>
 <div class="p-5"><div class="text-[10px] font-black uppercase tracking-widest text-cyan-600 mb-2">New Text</div>
 <div class="text-sm text-slate-900 font-mono leading-relaxed">${esc(r.proposed || '')}</div></div>
                </div>
            </div>` : `
 <div class="rounded-2xl border border-slate-100 overflow-hidden mb-4">
 ${r.section ? `<div class="px-5 py-2 bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-widest">${esc(r.section)}</div>` : ''}
 <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 ">
 <div class="p-5"><div class="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Original</div>
 <div class="text-sm text-slate-600 font-mono leading-relaxed">${esc(r.original || '')}</div></div>
 <div class="p-5"><div class="text-[10px] font-black uppercase tracking-widest text-green-500 mb-2">Proposed</div>
 <div class="text-sm text-slate-900 font-mono leading-relaxed">${esc(r.proposed || '')}</div></div>
                </div>
            </div>`).join('');
        };

        // Full view — identical structure to the proposal detail
        const fullSections = [];
 if (s.abstract) fullSections.push(`<h2 class="text-xl font-black text-slate-900 mt-2 mb-3">${isCIS ? 'Summary' : 'Summary'}</h2><div class="prose max-w-none text-sm">${renderMd(s.abstract)}</div>`);
 if (s.motivation) fullSections.push(`<h2 class="text-xl font-black text-slate-900 mt-2 mb-3">${isCIS ? 'Problem' : 'Why is this change needed?'}</h2><div class="prose max-w-none text-sm">${renderMd(s.motivation)}</div>`);
 if (s.analysis) fullSections.push(`<h2 class="text-xl font-black text-slate-900 mt-2 mb-3">${isCIS ? 'Context' : 'Analysis &amp; Test'}</h2><div class="prose max-w-none text-sm">${renderMd(s.analysis)}</div>`);
 if (s.impact) fullSections.push(`<h2 class="text-xl font-black text-slate-900 mt-2 mb-3">Impact</h2><div class="prose max-w-none text-sm">${renderMd(s.impact)}</div>`);
 if (s.revisions?.length) fullSections.push(`<h2 class="text-xl font-black text-slate-900 mt-2 mb-3">Proposed Revisions</h2>${renderRevisions(s.revisions)}`);
 if (s.exhibits) fullSections.push(`<h2 class="text-xl font-black text-slate-900 mt-2 mb-3">Links &amp; Files</h2><div class="prose max-w-none text-sm">${renderMd(s.exhibits)}</div>`);
 const fullContent = `<h1 class="text-2xl font-black tracking-tight text-slate-900 mb-6">${esc(v.title)}</h1>` + fullSections.join('<hr class="border-slate-100 my-4">');

        // Diff view — field by field word diff
        const DIFF_FIELDS = [
            { label: 'Title',       cur: v.title,     old: prev?.title },
            { label: 'Summary',     cur: s.abstract,  old: sp.abstract },
            { label: isCIS ? 'Problem' : 'Why is this change needed?', cur: s.motivation, old: sp.motivation },
            { label: isCIS ? 'Context' : 'Analysis & Test', cur: s.analysis, old: sp.analysis },
            { label: 'Impact',      cur: s.impact,    old: sp.impact },
            { label: 'Links & Files', cur: s.exhibits, old: sp.exhibits },
        ].filter(f => f.cur || f.old);

        const diffFields = DIFF_FIELDS.map(f => {
            const changed = (f.cur || '') !== (f.old || '');
            const diffHtml = prev ? versionWordDiff(f.old || '', f.cur || '') : esc(f.cur || '');
            return `
 <div class="${!changed ? 'opacity-40' : ''}">
 <div class="flex items-center gap-2 mb-2">
 <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">${esc(f.label)}</p>
 ${changed ? `<span class="text-[8px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">Changed</span>` : `<span class="text-[8px] text-slate-300 font-bold">Unchanged</span>`}
                </div>
 <div class="text-sm leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-2xl p-4 border border-slate-100 ">${diffHtml}</div>
            </div>`;
 }).join('<hr class="border-slate-100 my-2">');

        const hasPrev = !!prev;

        const div = document.createElement('div');
        div.innerHTML = `
        <div id="version-modal-backdrop"
             onclick="if(event.target===this) document.getElementById('version-modal-backdrop').remove()"
 class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

                <!-- Header -->
 <div class="flex items-start justify-between p-8 border-b border-slate-100 flex-shrink-0">
                    <div>
 <div class="flex items-center gap-3 mb-1">
 <span class="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest">V${v.version}</span>
 <span class="text-[10px] text-slate-400 font-bold">${when}</span>
 <span class="text-[10px] text-slate-400">· ${esc(v.created_by_name || v.created_by)}</span>
                        </div>
 <p class="text-sm font-black text-slate-900 mt-1">${esc(v.title)}</p>
 <p class="text-[10px] text-slate-400 mt-0.5 italic">${esc(v.change_summary || '')}</p>
                    </div>
                    <button onclick="document.getElementById('version-modal-backdrop').remove()"
 class="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-all ml-4">
 <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>

                <!-- Tabs -->
 <div class="flex gap-1 px-8 pt-4 flex-shrink-0">
                    <button id="ver-tab-full" onclick="window._verTab('full')"
 class="px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all bg-blue-600 text-white">
                        Full View
                    </button>
                    ${hasPrev ? `
                    <button id="ver-tab-diff" onclick="window._verTab('diff')"
 class="px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-500 hover:bg-slate-100 ">
                        Changes vs V${v.version - 1}
                    </button>` : ''}
                </div>

                <!-- Content -->
 <div class="overflow-y-auto p-8 space-y-6 flex-1">
 <div id="ver-panel-full" class="space-y-6">${fullContent}</div>
 <div id="ver-panel-diff" class="space-y-4 hidden">${diffFields}</div>
                </div>
            </div>
        </div>`;
        document.body.appendChild(div.firstElementChild);
        lucide.createIcons();

        window._verTab = (tab) => {
            document.getElementById('ver-panel-full').classList.toggle('hidden', tab !== 'full');
            document.getElementById('ver-panel-diff')?.classList.toggle('hidden', tab !== 'diff');
            document.getElementById('ver-tab-full').className = `px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'full' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 '}`;
            const diffBtn = document.getElementById('ver-tab-diff');
            if (diffBtn) diffBtn.className = `px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'diff' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 '}`;
        };
    } catch (e) {
        alert(e.message);
    }
};

// ── Suggestions ───────────────────────────────────────────────────────────────

const SUGGESTION_FIELD_LABELS = {
    title: 'Title',
    abstract: 'Summary',
    motivation: 'Why is this change needed?',
    analysis: 'Analysis & Test',
    impact: 'Impact',
    exhibits: 'Links & Files',
};

window.openSuggestModal = (field) => {
    const p = state.currentProposal;
    if (!p || !state.user?.is_editor) return;

    const structured = p.structured || {};
    const current = field === 'title' ? p.title : (structured[field] || '');
    const label = SUGGESTION_FIELD_LABELS[field] || field;

    const existing = document.getElementById('suggest-modal-backdrop');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.innerHTML = `
    <div id="suggest-modal-backdrop"
         onclick="if(event.target===this) document.getElementById('suggest-modal-backdrop').remove()"
 class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-2xl p-6 sm:p-8">
 <div class="flex items-center justify-between mb-6">
                <div>
 <p class="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Suggest Change</p>
 <h2 class="text-xl font-black text-slate-900 ">${label}</h2>
                </div>
                <button onclick="document.getElementById('suggest-modal-backdrop').remove()"
 class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
 <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            ${current ? `
 <div class="mb-4">
 <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Current</p>
 <div class="bg-slate-50 rounded-2xl p-4 text-sm text-slate-500 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">${escHtml(current)}</div>
            </div>` : ''}
 <div class="mb-4">
 <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Suggested Value</p>
                <textarea id="suggest-value" rows="6" placeholder="Enter your suggested text…"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white/80 text-slate-900 text-sm focus:border-blue-500 outline-none resize-none transition-all">${escHtml(current)}</textarea>
            </div>
 <div class="mb-6">
 <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Reason <span class="text-slate-300">(optional)</span></p>
                <input id="suggest-reason" type="text" placeholder="Why are you suggesting this change?"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white/80 text-slate-900 text-sm focus:border-blue-500 outline-none transition-all">
            </div>
 <p id="suggest-error" class="text-red-500 text-xs font-bold mb-3 hidden"></p>
 <div class="flex gap-3">
                <button onclick="window.submitSuggestion('${field}')"
 class="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-colors">
                    Submit Suggestion
                </button>
                <button onclick="document.getElementById('suggest-modal-backdrop').remove()"
 class="px-6 py-3 rounded-2xl text-slate-500 hover:bg-slate-100 font-black transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
    lucide.createIcons();
    document.getElementById('suggest-value')?.focus();
};

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.submitSuggestion = async (field) => {
    const value = document.getElementById('suggest-value')?.value.trim();
    const reason = document.getElementById('suggest-reason')?.value.trim() || null;
    const errEl = document.getElementById('suggest-error');

    if (!value) {
        if (errEl) { errEl.textContent = 'Suggested value cannot be empty.'; errEl.classList.remove('hidden'); }
        return;
    }

    const p = state.currentProposal;
    try {
        await createSuggestion(p.number, field, value, reason);
        document.getElementById('suggest-modal-backdrop')?.remove();
        state.suggestions = await fetchSuggestions(p.number);
        state.auditEvents = await fetchAudit(p.number);
        updateUI();
    } catch (e) {
        if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
    }
};

window.approveSuggestion = async (id) => {
    const p = state.currentProposal;
    if (!p) return;
    try {
        await approveSuggestion(p.number, id);
        const [proposal, suggestions, audit] = await Promise.all([
            fetchProposal(p.number), fetchSuggestions(p.number), fetchAudit(p.number),
        ]);
        state.currentProposal = proposal;
        state.suggestions = suggestions;
        state.auditEvents = audit;
        updateUI();
    } catch (e) {
        alert(e.message);
    }
};

window.rejectSuggestion = async (id) => {
    const p = state.currentProposal;
    if (!p) return;
    try {
        await rejectSuggestion(p.number, id);
        state.suggestions = await fetchSuggestions(p.number);
        state.auditEvents = await fetchAudit(p.number);
        updateUI();
    } catch (e) {
        alert(e.message);
    }
};

// ── Editor actions ────────────────────────────────────────────────────────────

window.editorSetStage = async (number, stage) => {
    if (!state.user?.is_editor) return;
    try {
        const updated = await addLabel(number, stage);
        if (state.currentProposal?.number === number) {
            state.currentProposal = updated;
            state.auditEvents = await fetchAudit(number);
        }
        await loadProposals();
        updateUI();
    } catch (e) {
        state.error = e.message;
        updateUI();
    }
};

window.editorToggleLabel = async (number, name, active) => {
    if (!state.user?.is_editor) return;
    try {
        const updated = active
            ? await addLabel(number, name)
            : await removeLabel(number, name);
        if (state.currentProposal?.number === number) {
            state.currentProposal = updated;
            state.auditEvents = await fetchAudit(number);
        }
        updateUI();
    } catch (e) {
        state.error = e.message;
        updateUI();
    }
};

window.authorToggleReady = async (number, active) => {
    if (!state.user) return;
    try {
        const updated = active
            ? await addLabel(number, 'author-ready')
            : await removeLabel(number, 'author-ready');
        if (state.currentProposal?.number === number) {
            state.currentProposal = updated;
            state.auditEvents = await fetchAudit(number);
        }
        updateUI();
    } catch (e) {
        state.error = e.message;
        updateUI();
    }
};

// Aliases used by detail.js component
window.editorSetLifecycle = (stage) => {
    const n = state.currentProposal?.number;
    if (n) window.editorSetStage(n, stage);
};

window.editorToggleStatusTag = (tag) => {
    const p = state.currentProposal;
    if (!p) return;
    const active = (p.labels || []).some(l => l.name === tag);
    window.editorToggleLabel(p.number, tag, !active);
};

window.editorToggleSignal = async (tag) => {
    const p = state.currentProposal;
    if (!p || !state.user?.is_editor) return;
    const SIGNALS = ['editor-ok', 'editor-concern'];
    const labels = (p.labels || []).map(l => l.name);
    const currentSignal = SIGNALS.find(s => labels.includes(s)) || null;
    try {
        if (currentSignal === tag) {
            // clicking active signal removes it
            const updated = await removeLabel(p.number, tag);
            state.currentProposal = updated;
        } else {
            if (currentSignal) await removeLabel(p.number, currentSignal);
            const updated = await addLabel(p.number, tag);
            state.currentProposal = updated;
        }
        state.auditEvents = await fetchAudit(p.number);
        updateUI();
    } catch (e) {
        state.error = e.message;
        updateUI();
    }
};

window.authorSignalReady = () => {
    const p = state.currentProposal;
    if (!p) return;
    const active = (p.labels || []).some(l => l.name === 'author-ready');
    window.authorToggleReady(p.number, !active);
};

async function applyWithdrawResult(number, updated) {
    state.currentProposal = updated;
    state.auditEvents = await fetchAudit(number);
    state.proposals = state.proposals.map(pr => pr.number === number ? updated : pr);
    updateUI();
}

window.authorWithdraw = async () => {
    const p = state.currentProposal;
    if (!p || !state.user) return;
    if (!confirm('Withdraw this proposal? This action is permanent.')) return;
    try {
        const updated = await withdrawProposal(p.number);
        await applyWithdrawResult(p.number, updated);
    } catch (e) {
        state.error = e.message;
        updateUI();
    }
};

window.editorWithdraw = async () => {
    const p = state.currentProposal;
    if (!p || !state.user?.is_editor) return;
    const myStake = state.user.stake_address;
    const pending = p.withdrawal_requested_by;
    // No pending request → this call opens one. A pending request by a different
    // editor → this call confirms and finalises it (two-person rule).
    const msg = pending && pending !== myStake
        ? 'Confirm withdrawal of this proposal? This permanently closes it.'
        : 'Request withdrawal of this proposal? A second, different editor must confirm before it takes effect.';
    if (!confirm(msg)) return;
    try {
        const updated = await withdrawProposal(p.number);
        await applyWithdrawResult(p.number, updated);
    } catch (e) {
        state.error = e.message;
        updateUI();
    }
};

window.editorCancelWithdraw = async () => {
    const p = state.currentProposal;
    if (!p || !state.user?.is_editor) return;
    if (!confirm('Cancel the pending withdrawal request?')) return;
    try {
        const updated = await cancelWithdrawal(p.number);
        await applyWithdrawResult(p.number, updated);
    } catch (e) {
        state.error = e.message;
        updateUI();
    }
};

// ── Moderation: flag for removal (editor/admin) ───────────────────────────────

// Generic reason-required modal. onSubmit(reason) is called with the trimmed
// text; the modal shows an error if the API rejects it.
function openReasonModal({ title, intro, label, placeholder, confirmText, confirmClass, onSubmit }) {
    document.getElementById('reason-modal-backdrop')?.remove();
    const div = document.createElement('div');
    div.innerHTML = `
    <div id="reason-modal-backdrop"
         onclick="if(event.target===this) document.getElementById('reason-modal-backdrop').remove()"
         class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div class="bg-white rounded-[2rem] border border-slate-100 shadow-2xl w-full max-w-md p-6 sm:p-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-black text-slate-900">${escapeHtmlGlobal(title)}</h2>
          <button onclick="document.getElementById('reason-modal-backdrop').remove()"
                  class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        ${intro ? `<p class="text-sm text-slate-500 mb-4">${escapeHtmlGlobal(intro)}</p>` : ''}
        <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">${escapeHtmlGlobal(label)}</label>
        <textarea id="reason-input" rows="4" placeholder="${escapeHtmlGlobal(placeholder || '')}"
          class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white text-slate-900 text-sm focus:outline-none focus:border-blue-400 resize-none mb-3"></textarea>
        <p id="reason-error" class="hidden text-red-500 text-xs font-bold mb-3"></p>
        <div class="flex gap-3">
          <button id="reason-submit"
            class="flex-1 py-3 rounded-2xl ${confirmClass || 'bg-blue-600 hover:bg-blue-700'} text-white font-black transition-colors">${escapeHtmlGlobal(confirmText || 'Submit')}</button>
          <button onclick="document.getElementById('reason-modal-backdrop').remove()"
            class="px-6 py-3 rounded-2xl text-slate-500 hover:bg-slate-100 font-black transition-colors">Cancel</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    const input = document.getElementById('reason-input');
    input?.focus();
    document.getElementById('reason-submit').onclick = async () => {
        const reason = input.value.trim();
        const err = document.getElementById('reason-error');
        if (!reason) { err.textContent = 'A written reason is required.'; err.classList.remove('hidden'); return; }
        const btn = document.getElementById('reason-submit');
        btn.disabled = true; btn.textContent = 'Working…';
        try {
            await onSubmit(reason);
            document.getElementById('reason-modal-backdrop')?.remove();
        } catch (e) {
            err.textContent = e.message || 'Something went wrong.'; err.classList.remove('hidden');
            btn.disabled = false; btn.textContent = confirmText || 'Submit';
        }
    };
}

window.flagProposalForRemoval = () => {
    const p = state.currentProposal;
    if (!p || !(state.user?.is_editor || state.user?.is_admin)) return;
    openReasonModal({
        title: 'Flag proposal for removal',
        intro: 'This hides the proposal and sends it to an admin to review. The author is notified it is under review.',
        label: 'Why should this be removed?',
        placeholder: 'Explain how this violates the Terms of Use…',
        confirmText: 'Flag for removal',
        confirmClass: 'bg-red-600 hover:bg-red-700',
        onSubmit: async (reason) => {
            await flagProposal(p.number, reason);
            await window.openProposal(p.number, false);
        },
    });
};

window.flagCommentForRemoval = (commentId) => {
    const p = state.currentProposal;
    if (!p || !(state.user?.is_editor || state.user?.is_admin)) return;
    openReasonModal({
        title: 'Flag comment for removal',
        intro: 'This hides the comment and sends it to an admin to review. The author is notified it is under review.',
        label: 'Why should this be removed?',
        placeholder: 'Explain how this violates the Terms of Use…',
        confirmText: 'Flag for removal',
        confirmClass: 'bg-red-600 hover:bg-red-700',
        onSubmit: async (reason) => {
            await flagComment(commentId, reason);
            state.comments = await fetchComments(p.number);
            state.auditEvents = await fetchAudit(p.number);
            updateUI();
        },
    });
};

window.toggleAuditTrail = () => {
    const el = document.getElementById('audit-trail-body');
    const btn = document.getElementById('audit-trail-toggle');
    if (!el) return;
    const hidden = el.style.display === 'none' || el.hidden;
    el.style.display = hidden ? '' : 'none';
    if (btn) btn.setAttribute('data-open', hidden ? 'true' : 'false');
};

window.toggleEventExpansion = (id) => {
    const el = document.getElementById(`audit-event-${id}`);
    if (!el) return;
    el.classList.toggle('expanded');
};

// ── Preview overlay ───────────────────────────────────────────────────────────

function buildPreviewHtml(title, structured, type) {
    const isCIS = type === 'CIS';
    const md = text => window.safeMarkdown(text);
    const esc = str => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const sections = [];
    if (structured.abstract)
 sections.push(`<h2 class="text-2xl font-black text-slate-900 mt-10 mb-4">Summary</h2><div class="prose max-w-none">${md(structured.abstract)}</div>`);

    if (isCIS) {
        if (structured.motivation)
 sections.push(`<h2 class="text-2xl font-black text-slate-900 mt-10 mb-4">Problem</h2><div class="prose max-w-none">${md(structured.motivation)}</div>`);
        if (structured.analysis)
 sections.push(`<h2 class="text-2xl font-black text-slate-900 mt-10 mb-4">Context</h2><div class="prose max-w-none">${md(structured.analysis)}</div>`);
        if (structured.impact)
 sections.push(`<h2 class="text-2xl font-black text-slate-900 mt-10 mb-4">Impact</h2><div class="prose max-w-none">${md(structured.impact)}</div>`);
    } else {
        if (structured.motivation)
 sections.push(`<h2 class="text-2xl font-black text-slate-900 mt-10 mb-4">Why is this change needed?</h2><div class="prose max-w-none">${md(structured.motivation)}</div>`);
        if (structured.analysis)
 sections.push(`<h2 class="text-2xl font-black text-slate-900 mt-10 mb-4">Analysis &amp; Test</h2><div class="prose max-w-none">${md(structured.analysis)}</div>`);
    }

    if (structured.revisions?.length) {
        const rows = structured.revisions.filter(r => r.original || r.insert_after || r.proposed).map(r =>
            r.type === 'addition' ? `
 <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
 <div class="bg-cyan-50 border border-cyan-200 rounded-2xl p-5">
 <p class="text-[10px] font-black uppercase tracking-widest text-cyan-500 mb-2">Insert After — ${esc(r.section || '')}</p>
 <p class="text-sm text-slate-600 italic leading-relaxed">${esc(r.insert_after)}</p>
                </div>
 <div class="bg-cyan-50 border border-cyan-200 rounded-2xl p-5">
 <p class="text-[10px] font-black uppercase tracking-widest text-cyan-600 mb-2">New Text</p>
 <div class="text-sm text-slate-700 leading-relaxed prose max-w-none">${md(r.proposed)}</div>
                </div>
            </div>` : `
 <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
 <div class="bg-red-50 border border-red-200 rounded-2xl p-5">
 <p class="text-[10px] font-black uppercase tracking-widest text-red-500 mb-2">Original — ${esc(r.section || '')}</p>
 <p class="text-sm text-slate-600 italic leading-relaxed">${esc(r.original)}</p>
                </div>
 <div class="bg-green-50 border border-green-200 rounded-2xl p-5">
 <p class="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2">Proposed</p>
 <div class="text-sm text-slate-700 leading-relaxed prose max-w-none">${md(r.proposed)}</div>
                </div>
            </div>`).join('');
 sections.push(`<h2 class="text-2xl font-black text-slate-900 mt-10 mb-4">Structured Revisions</h2>${rows}`);
    }

    if (structured.exhibits)
 sections.push(`<h2 class="text-2xl font-black text-slate-900 mt-10 mb-4">Links &amp; Files</h2><div class="prose max-w-none">${md(structured.exhibits)}</div>`);

    return `
 <div class="bg-white/80 p-8 sm:p-16 rounded-[3rem] border border-slate-100 shadow-sm">
 <div class="flex flex-wrap gap-3 mb-8">
 <span class="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-200 bg-blue-50 text-blue-700">${esc(type)}</span>
 ${structured.category ? `<span class="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-slate-100 text-slate-600">${esc(structured.category)}</span>` : ''}
            </div>
 <h1 class="text-4xl font-black tracking-tight text-slate-900 mb-8">${esc(title || 'Untitled')}</h1>
            ${sections.join('\n')}
        </div>`;
}

// Preview HTML for the current wizard data — used inline on Step 5 (Review).
window.wizardPreviewHtml = () => {
    const w = state.wizardData || {};
    const type = w.type || 'CAP';
    const structured = {
        type, category: w.category || '', abstract: w.abstract || '',
        motivation: w.motivation || '', analysis: w.analysis || '',
        impact: w.impact || '', exhibits: w.exhibits || '',
        revisions: (w.selectedText || []).map((sel, i) => sel.kind === 'add_after'
            ? { type: 'addition', insert_after: sel.text || '', proposed: w.revisions?.[i] || '', section: sel.sectionId || '' }
            : { original: sel.text || '', proposed: w.revisions?.[i] || '', section: sel.sectionId || '' }),
    };
    return buildPreviewHtml(w.title || '', structured, type);
};

window.previewEdit = () => {
    const form = document.getElementById('edit-form');
    if (!form) return;
    const fd = new FormData(form);
    const p = state.currentProposal;
    const type = p?.type || 'CAP';
    const structured = {
        ...(p?.structured || {}),
        abstract: fd.get('abstract') || '',
        motivation: fd.get('motivation') || '',
        analysis: fd.get('analysis') || '',
        impact: fd.get('impact') || '',
        exhibits: fd.get('specification_extra') || '',
    };
    showPreviewOverlay(fd.get('title') || p?.title || '', structured, type);
};

function showPreviewOverlay(title, structured, type) {
    const existing = document.getElementById('preview-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'preview-overlay';
    overlay.className = 'fixed inset-0 z-[200] bg-slate-50 overflow-y-auto';
 overlay.innerHTML = `<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex items-center justify-between mb-8 p-5 bg-amber-50 border border-amber-200 rounded-2xl sticky top-4 z-10 backdrop-blur-sm">
            <div class="flex items-center gap-3">
                <i data-lucide="eye" class="w-4 h-4 text-amber-600"></i>
                <span class="text-xs font-black uppercase tracking-widest text-amber-700">Preview — Not Yet Submitted</span>
            </div>
            <button onclick="window.closePreview()" class="flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-900 transition-colors px-4 py-2 rounded-xl hover:bg-white/60">
                <i data-lucide="x" class="w-4 h-4"></i> Close
            </button>
        </div>
        ${buildPreviewHtml(title, structured, type)}</div>`;
    document.body.appendChild(overlay);
    lucide.createIcons();
    overlay.scrollTop = 0;
}

window.closePreview = () => {
    const overlay = document.getElementById('preview-overlay');
    if (overlay) overlay.remove();
};

// ── Edit proposal ─────────────────────────────────────────────────────────────

window.openEdit = (number) => {
    const p = state.proposals.find(p => p.number === number) || state.currentProposal;
    if (!p) return;
    state.editingProposal = { ...p };
    state.view = 'edit';
    window.location.hash = `#/edit/${number}`;
    updateUI();
};

window.startEdit = () => {
    const n = state.currentProposal?.number;
    if (n) window.openEdit(n);
};

window.handleEdit = async (event) => {
    event.preventDefault();
    if (!state.editingProposal) return;
    const fd = new FormData(event.target);
    const number = state.editingProposal.number;
    const title = fd.get('title') || state.editingProposal.title;

    const abstract   = fd.get('abstract') || '';
    const motivation = fd.get('motivation') || '';
    const analysis   = fd.get('analysis') || '';
    const impact     = fd.get('impact') || '';
    const exhibits   = fd.get('exhibits') || '';
    const existing   = state.editingProposal.structured || {};

    const structured = {
        ...existing,
        abstract, motivation, analysis, impact, exhibits,
    };

    state.loading = { ...state.loading, submitting: true };
    updateUI();
    try {
        const updated = await updateProposal(number, { title, structured });
        state.currentProposal = updated;
        state.proposals = state.proposals.map(p => p.number === number ? updated : p);
        state.auditEvents = await fetchAudit(number);
        state.editingProposal = null;
        state.view = 'detail';
        window.location.hash = `#/detail/${number}`;
    } catch (e) {
        state.error = e.message;
    } finally {
        state.loading = { ...state.loading, submitting: false };
        updateUI();
    }
};

// ── Auth / wallet ─────────────────────────────────────────────────────────────

function showWalletModal() {
    const existing = document.getElementById('wallet-modal-backdrop');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.innerHTML = renderWalletModal();
    document.body.appendChild(div.firstElementChild);
    lucide.createIcons();

    window._walletModalPickWallet = (walletId) => {
        // Alpha agreement is per account (not per browser) and is shown after we
        // know the connecting wallet's stake address — see _walletModalSelect.
        window._walletModalSelect(walletId);
    };

    window._walletModalBack = () => {
        document.getElementById('wallet-modal-backdrop')?.remove();
        showWalletModal();
    };

    window._walletModalSelect = async (walletId) => {
        const savedName = localStorage.getItem('cap_display_name') || null;
        const body = document.getElementById('wallet-modal-body');
 if (body) body.innerHTML = `<div class="py-8 text-center"><div class="loading-spinner mx-auto mb-4"></div><p class="text-slate-500 font-bold">Connecting wallet…</p></div>`;
        try {
            const result = await connectAndAuth(walletId, savedName);
            document.getElementById('wallet-modal-backdrop')?.remove();

            // Per-account alpha agreement. The server is the source of truth
            // (result.alpha_agreed); on acceptance we record it server-side.
            if (!result.alpha_agreed) {
                await showAlphaAgreement();
                try { await acceptAlphaAgreement(); } catch (_) { /* recorded on next login */ }
            }

            state.user = { stake_address: result.stake_address, display_name: result.display_name, is_editor: result.is_editor, is_admin: result.is_admin };
            refreshUnreadCount();

            // First-time user: no display name in the DB yet — ask for one after signing
            if (!result.display_name) {
                showSetNameModal();
            } else {
                updateUI();
            }
        } catch (e) {
            console.error('Wallet connection failed:', e);
            document.getElementById('wallet-modal-backdrop')?.remove();
            state.error = `Wallet connection failed: ${e.message}`;
            updateUI();
        }
    };

    function showSetNameModal() {
        const div = document.createElement('div');
        div.innerHTML = `
        <div id="set-name-backdrop"
 class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-sm p-6 sm:p-8">
 <h2 class="text-xl font-black text-slate-900 mb-2">Choose a display name</h2>
 <p class="text-sm text-slate-500 mb-6">This is shown on your proposals and comments. You can skip and use your stake address.</p>
                <input id="set-name-input" type="text" placeholder="Display name (optional)" maxlength="40"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400 mb-4 font-medium"
                    onkeydown="if(event.key==='Enter') window._submitSetName()">
                <button onclick="window._submitSetName()"
 class="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-colors mb-2">
                    Save name
                </button>
                <button onclick="window._skipSetName()"
 class="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
                    Skip for now
                </button>
            </div>
        </div>`;
        document.body.appendChild(div.firstElementChild);
        document.getElementById('set-name-input')?.focus();
    }

    window._submitSetName = async () => {
        const name = document.getElementById('set-name-input')?.value.trim();
        document.getElementById('set-name-backdrop')?.remove();
        if (name) {
            try {
                const result = await setDisplayName(name);
                localStorage.setItem('cap_token', result.token);
                localStorage.setItem('cap_display_name', result.display_name || '');
                state.user = { stake_address: result.stake_address, display_name: result.display_name, is_editor: result.is_editor, is_admin: result.is_admin };
            } catch (e) {
                // Non-fatal — user is already signed in, just without a name
            }
        }
        updateUI();
    };

    window._skipSetName = () => {
        document.getElementById('set-name-backdrop')?.remove();
        updateUI();
    };

    window._walletModalDevLogin = async () => {
        if (!DEV_MODE) return;
        document.getElementById('wallet-modal-backdrop')?.remove();
        const result = await devLogin('Dev User');
        state.user = result;
        updateUI();
    };
}

window.loginWithWallet = showWalletModal;

window.logoutWallet = () => {
    logout();
    state.user = null;
    state.notifications = [];
    state.notificationsOpen = false;
    state.unreadCount = 0;
    updateUI();
};

window.openProfile = () => {
    const existing = document.getElementById('profile-modal-backdrop');
    if (existing) existing.remove();

    const current = state.user?.display_name || '';
    const addr = state.user?.stake_address || '';

    const div = document.createElement('div');
    div.innerHTML = `
    <div id="profile-modal-backdrop"
         onclick="if(event.target===this) document.getElementById('profile-modal-backdrop').remove()"
 class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-sm p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
 <div class="flex items-center justify-between mb-6">
 <h2 class="text-xl font-black text-slate-900 ">Profile</h2>
                <button onclick="document.getElementById('profile-modal-backdrop').remove()"
 class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
 <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

 <p class="text-xs font-mono text-slate-400 bg-slate-50 rounded-2xl px-4 py-3 mb-6 break-all">${addr}</p>

 <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Display name</label>
            <input id="profile-name-input" type="text" value="${escapeHtmlGlobal(current)}" placeholder="Your display name" maxlength="40"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400 mb-6 font-medium"
                onkeydown="if(event.key==='Enter') window._saveProfile()">

 <div id="profile-error" class="hidden text-red-500 text-sm font-bold mb-4"></div>

            <button onclick="window._saveProfile()"
 class="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-colors">
                Save changes
            </button>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
    document.getElementById('profile-name-input')?.focus();
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window._saveProfile = async () => {
    const input = document.getElementById('profile-name-input');
    const errEl = document.getElementById('profile-error');
    const name = input?.value.trim() || '';

    if (!name) {
        if (errEl) { errEl.textContent = 'Display name cannot be empty.'; errEl.classList.remove('hidden'); }
        return;
    }

    const btn = document.querySelector('#profile-modal-backdrop button.bg-blue-600');
    if (btn) btn.textContent = 'Saving…';

    try {
        const result = await updateProfile(name);
        localStorage.setItem('cap_token', result.token);
        localStorage.setItem('cap_display_name', result.display_name || '');
        state.user = { stake_address: result.stake_address, display_name: result.display_name, is_editor: result.is_editor, is_admin: result.is_admin };
        document.getElementById('profile-modal-backdrop')?.remove();
        updateUI();
    } catch (e) {
        if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
        if (btn) btn.textContent = 'Save changes';
    }
};

// ── Wizard helpers ────────────────────────────────────────────────────────────

window.updateWizard = (data) => {
    state.wizardData = { ...state.wizardData, ...data };
    state.wizardError = null;  // clear any blocking warning once the user changes input
};
// Step counter runs 1-6, but CIS proposals skip the CAP-only Select/Propose
// screens (2 & 3), so navigation jumps over them in both directions.
const nextWizardStep = (step, wizard) => {
    let s = step + 1;
    while (s < 5 && isStepSkipped(s, wizard)) s++;
    return Math.min(s, 5);
};
const prevWizardStep = (step, wizard) => {
    let s = step - 1;
    while (s > 1 && isStepSkipped(s, wizard)) s--;
    return Math.max(s, 1);
};
window.wizardNext     = () => {
    const err = validateStep(state.wizardStep, state.wizardData || {});
    if (err) { state.wizardError = err; updateUI(); return; }
    state.wizardError = null;
    state.wizardStep = nextWizardStep(state.wizardStep, state.wizardData || {});
    updateUI();
};
window.wizardBack     = () => {
    state.wizardError = null;
    window.dismissWizardCommitToast?.();
    state.wizardStep = prevWizardStep(state.wizardStep, state.wizardData || {});
    updateUI();
};
window.wizardNextStep = () => window.wizardNext();
window.wizardPrevStep = () => window.wizardBack();
window.wizardSubmit   = () => window.submitWizard();
window.wizardReset    = () => { state.wizardData = {}; state.wizardStep = 1; state.wizardError = null; updateUI(); };
// Confirmed reset for the "Start Over" button — guards against a misclick
// discarding a draft the user has spent several steps building.
window.wizardStartOver = () => {
    if (!confirm('Start over? This discards everything you\'ve entered in the wizard.')) return;
    window.wizardReset();
};

// True when the user has entered anything worth warning about before leaving.
function wizardHasData() {
    const w = state.wizardData || {};
    return !!((w.title || '').trim() || (w.abstract || '').trim() || (w.motivation || '').trim() ||
              (w.analysis || '').trim() || (w.impact || '').trim() || (w.exhibits || '').trim() ||
              (w.selectedText && w.selectedText.length) ||
              (w.revisions && Object.values(w.revisions).some(v => (v || '').trim())));
}

// Leave the wizard (logo / Discard). Warns first if there are unsaved edits.
window.wizardExit = () => {
    if (wizardHasData() && !confirm('Discard this proposal? Everything you\'ve entered will be lost.')) return;
    state.wizardData = {};
    state.wizardStep = 1;
    state.wizardError = null;
    state.wizardSubmitted = null;
    window.setView('dashboard');
};

window.previewWizard = () => {
    const w = state.wizardData || {};
    const type = w.type || 'CAP';
    const structured = {
        type,
        category: w.category || '',
        abstract: w.abstract || '',
        motivation: w.motivation || '',
        analysis: w.analysis || '',
        impact: w.impact || '',
        exhibits: w.exhibits || '',
        revisions: (w.selectedText || []).map((sel, idx) => sel.kind === 'add_after'
            ? { type: 'addition', insert_after: sel.text || '', proposed: w.revisions?.[idx] || '', section: sel.sectionId || '' }
            : { original: sel.text || '', proposed: w.revisions?.[idx] || '', section: sel.sectionId || '' }
        ),
    };
    showPreviewOverlay(w.title || '', structured, type);
};

window.removeWizardSelection = (idx) => {
    const sel = (state.wizardData.selectedText || []).filter((_, i) => i !== idx);
    state.wizardData = { ...state.wizardData, selectedText: sel };
    updateUI();
};

window.viewProposalDiff = async (proposalNumber) => {
    const draftFilename = `cap-${proposalNumber}-proposed.md`;
    state.constitutionVersions = [];
    state.constitutionCurrentVersion = null;
    state.constitutionCompareVersion = null;
    state.view = 'constitution';
    state.loading = { ...state.loading, constitution: true };
    // Update the URL without firing 'hashchange' — that event triggers
    // handleRouting() -> loadConstitution(), which would race this function's
    // own load below and randomly clobber one side of the diff (the visible
    // symptom: one side renders empty until you toggle diff mode off and on).
    history.replaceState(null, '', '#/constitution');
    updateUI();
    try {
        const mapVersions = raw => raw.map((v, i) => ({
            name: v.display_name || v.filename.replace('.md', ''),
            filename: v.filename,
            isCurrent: i === 0,
            content: null,
        }));
        let raw = await fetchConstitutionVersions();
        // Viewing a diff is a read. Only if the draft doesn't exist yet do we
        // attempt to generate it (a write that requires author/editor rights);
        // for everyone else the existing draft simply loads.
        if (!raw.some(v => v.filename === draftFilename)) {
            try { await generateDraftConstitution(proposalNumber); raw = await fetchConstitutionVersions(); }
            catch (_) { /* not permitted or nothing to generate — handled below */ }
        }
        state.constitutionVersions = mapVersions(raw);
        const base  = state.constitutionVersions.find(v => !v.filename.startsWith('cap-'));
        const draft = state.constitutionVersions.find(v => v.filename === draftFilename);
        if (!base || !draft) { state.error = 'This proposal has no proposed constitution changes to compare yet.'; updateUI(); return; }
        state.constitutionCurrentVersion = base.name;
        state.constitutionCompareVersion = draft.name;
        await Promise.all([loadConstitutionVersionByName(base.name), loadConstitutionVersionByName(draft.name)]);
    } catch (e) {
        state.error = e.message;
    }
    state.loading = { ...state.loading, constitution: false };
    updateUI();
};

window.openConstitutionForWizard = () => {
    // save wizard state and go to constitution; constitution's commitSelection
    // will call addTextToCAP / addTextToCIS which navigate back
    state.view = 'constitution';
    // Avoid 'hashchange' firing a second, redundant loadConstitution() via
    // handleRouting() — we already call it explicitly below.
    history.replaceState(null, '', '#/constitution');
    loadConstitution();
};

window.addTextToCAP = () => {
    const selections = window.stagedSelections?.filter(s => s.type === 'CAP') || [];
    if (selections.length) {
        state.wizardData = { ...state.wizardData, selectedText: selections, type: 'CAP' };
    }
    showSelectionAddedBanner();
};

window.addTextToCIS = () => {
    const selections = window.stagedSelections?.filter(s => s.type === 'CIS') || [];
    if (selections.length) {
        state.wizardData = { ...state.wizardData, selectedText: selections, type: 'CIS' };
    }
    showSelectionAddedBanner();
};

function showSelectionAddedBanner() {
    const existing = document.getElementById('selection-added-banner');
    if (existing) existing.remove();

    const count = (state.wizardData.selectedText || []).length;
    const banner = document.createElement('div');
    banner.id = 'selection-added-banner';
    banner.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:9999;white-space:nowrap;';
    banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;background:#0f172a;color:#fff;padding:14px 20px;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);">
            <span style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0;"></span>
                ${count} selection${count !== 1 ? 's' : ''} added
            </span>
            <button onclick="document.getElementById('selection-added-banner').remove()"
                style="background:rgba(255,255,255,0.1);border:none;color:#fff;cursor:pointer;padding:7px 16px;border-radius:12px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;">
                Add More
            </button>
            <button onclick="window.returnToWizardFromConstitution()"
                style="background:#2563eb;border:none;color:#fff;cursor:pointer;padding:7px 16px;border-radius:12px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;">
                Back to Wizard
            </button>
        </div>`;
    document.body.appendChild(banner);
}

window.returnToWizardFromConstitution = () => {
    const banner = document.getElementById('selection-added-banner');
    if (banner) banner.remove();
    window.setView('wizard');
};

// ── Learn / guides ────────────────────────────────────────────────────────────

window.openGuide = async (slug) => {
    state.activeGuide = slug;
    state.guideHtml = null;
    state.view = 'learn';
    window.location.hash = `#/guides/${slug}`;
    updateUI();

    // Try API first (editor-saved version), fall back to static file if the API has no content yet
    let markdown = null;
    try {
        const data = await fetchGuide(slug);
        markdown = data.content || null;
        state.guideLastEditor = data.updated_by_name || null;
        state.guideLastUpdated = data.updated_at || null;
    } catch {
        state.guideLastEditor = null;
        state.guideLastUpdated = null;
    }
    if (!markdown) {
        try {
            const res = await fetch(`docs/guides/${slug}.md`);
            if (res.ok) markdown = await res.text();
        } catch {}
    }

    if (markdown) {
        state.guideHtml = window.safeMarkdown(markdown);
        state.guideRawContent = markdown;
    } else {
        state.guideHtml = null;
        state.guideRawContent = null;
    }
    updateUI();
};

window.closeGuide = () => {
    state.activeGuide = null;
    state.guideHtml = null;
    state.guideRawContent = null;
    state.guideLastEditor = null;
    state.guideLastUpdated = null;
    window.location.hash = '#/guides';
    updateUI();
};

window.openNewGuideModal = () => {
    const existing = document.getElementById('new-guide-modal');
    if (existing) existing.remove();

    // Collect existing sections from state.guides
    const sections = [...new Map(
        state.guides.map(g => [g.section, g.section_label || g.section])
    ).entries()].map(([value, label]) => ({ value, label }));

    const sectionOptions = sections.map(s =>
        `<option value="${s.value}">${s.label}</option>`
    ).join('');

    const div = document.createElement('div');
    div.innerHTML = `
    <div id="new-guide-modal"
         onclick="if(event.target===this) document.getElementById('new-guide-modal').remove()"
 class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-md p-6 sm:p-8">
 <div class="flex items-center justify-between mb-6">
 <div class="flex items-center gap-3">
 <div class="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
 <i data-lucide="plus" class="w-5 h-5 text-blue-600"></i>
                    </div>
 <h2 class="text-xl font-black text-slate-900 ">New Guide</h2>
                </div>
                <button onclick="document.getElementById('new-guide-modal').remove()"
 class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
 <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

 <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Title</label>
            <input id="ng-title" type="text" placeholder="Guide title" maxlength="120"
                oninput="window._ngSlugFromTitle()"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 focus:outline-none focus:border-blue-400 mb-4 font-medium">

 <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Slug <span class="font-normal normal-case tracking-normal text-slate-400">— URL identifier</span></label>
            <input id="ng-slug" type="text" placeholder="my-guide-slug" maxlength="80"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 focus:outline-none focus:border-blue-400 mb-4 font-mono text-sm">

 <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Section</label>
            <select id="ng-section" onchange="window._ngToggleNewSection()"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 focus:outline-none focus:border-blue-400 mb-3 font-medium">
                ${sectionOptions}
                <option value="__new__">+ New section…</option>
            </select>
 <div id="ng-new-section-wrap" class="hidden mb-4">
                <input id="ng-new-section-label" type="text" placeholder="Section name (e.g. Getting Started)"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 focus:outline-none focus:border-blue-400 font-medium">
            </div>

 <div id="ng-error" class="hidden text-red-500 text-sm font-bold mb-4"></div>

            <button onclick="window._createNewGuide()"
 class="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-colors">
                Create &amp; Edit
            </button>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
    document.getElementById('ng-title')?.focus();
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window._ngSlugFromTitle = () => {
    const title = document.getElementById('ng-title')?.value || '';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const el = document.getElementById('ng-slug');
    if (el) el.value = slug;
};

window._ngToggleNewSection = () => {
    const sel = document.getElementById('ng-section');
    const wrap = document.getElementById('ng-new-section-wrap');
    if (sel && wrap) wrap.classList.toggle('hidden', sel.value !== '__new__');
};

window._createNewGuide = async () => {
    const title = document.getElementById('ng-title')?.value?.trim();
    const slug = document.getElementById('ng-slug')?.value?.trim();
    const sectionSel = document.getElementById('ng-section')?.value;
    const isNewSection = sectionSel === '__new__';
    const newSectionLabel = document.getElementById('ng-new-section-label')?.value?.trim();
    const errEl = document.getElementById('ng-error');

    if (!title) { errEl.textContent = 'Please enter a title.'; errEl.classList.remove('hidden'); return; }
    if (!slug) { errEl.textContent = 'Please enter a slug.'; errEl.classList.remove('hidden'); return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { errEl.textContent = 'Slug can only contain lowercase letters, numbers, and hyphens.'; errEl.classList.remove('hidden'); return; }
    if (isNewSection && !newSectionLabel) { errEl.textContent = 'Please enter a name for the new section.'; errEl.classList.remove('hidden'); return; }

    const section = isNewSection
        ? newSectionLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        : sectionSel;
    const section_label = isNewSection ? newSectionLabel : null;

    try {
        await upsertGuide(slug, title, '', section, section_label, 0);
        document.getElementById('new-guide-modal').remove();
        state.guidesLoaded = false;
        window.openGuide(slug);
    } catch (e) {
        errEl.textContent = e.message || 'Failed to create guide.';
        errEl.classList.remove('hidden');
    }
};

window.deleteGuide = async (slug) => {
    if (!confirm('Delete this guide? This cannot be undone.')) return;
    try {
        await deleteGuide(slug);
        state.guidesLoaded = false;
        state.activeGuide = null;
        state.guideHtml = null;
        window.location.hash = '#/guides';
        await loadGuides();
    } catch (e) {
        alert(e.message || 'Failed to delete guide.');
    }
};

// ── Apply markdown formatting (toolbar) ──────────────────────────────────────

window.applyMarkdown = (targetId, format) => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const sel = el.value.slice(start, end);
    const map = {
        bold:   ['**', '**'],
        italic: ['_', '_'],
        link:   ['[', '](url)'],
        code:   ['`', '`'],
        h2:     ['## ', ''],
        h3:     ['### ', ''],
        bullet: ['- ', ''],
        quote:  ['> ', ''],
    };
    const [pre, post] = map[format] || ['', ''];
    const replacement = pre + (sel || 'text') + post;
    el.setRangeText(replacement, start, end, 'end');
    el.dispatchEvent(new Event('input'));
    el.focus();
};

// ── Filter helpers ────────────────────────────────────────────────────────────

window.setKanbanSearch = (q) => { state.kanbanSearch = q; updateUI(); };
window.setRegistrySearch = (q) => { state.registrySearch = q; updateUI(); };
window.kanbanToggleTagPanel = () => { state.kanbanTagPanelOpen = !state.kanbanTagPanelOpen; updateUI(); };

// ── Bootstrap ─────────────────────────────────────────────────────────────────

// Read-only "what does alpha mean" modal, opened from the banner's "Read more".
window.showAlphaInfo = () => {
    document.getElementById('alpha-info-backdrop')?.remove();
    const div = document.createElement('div');
    div.innerHTML = `
    <div id="alpha-info-backdrop"
         onclick="if(event.target===this) document.getElementById('alpha-info-backdrop').remove()"
         style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:1rem;">
      <div style="background:white;border-radius:1.5rem;max-width:560px;width:100%;padding:2.5rem;box-shadow:0 25px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;font-family:'Poppins',sans-serif;">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
          <span style="background:#dc2626;color:white;font-size:10px;font-weight:800;letter-spacing:.08em;padding:3px 10px;border-radius:999px;text-transform:uppercase;">Alpha</span>
          <h2 style="margin:0;font-size:1.25rem;font-weight:700;color:#0f172a;">This is an alpha release</h2>
        </div>
        <p style="margin:0 0 1rem;font-size:0.8125rem;color:#475569;">The CAP Portal is an early, in-testing version made available for feedback. Please keep in mind:</p>
        <ul style="margin:0 0 1.25rem;padding-left:1.25rem;font-size:0.8125rem;color:#475569;line-height:1.7;">
          <li>It may contain bugs, be unavailable, or experience interruptions or data loss.</li>
          <li>We don't guarantee accuracy, reliability, or availability — use it at your own risk.</li>
          <li>Don't rely on it for critical activities or store sensitive information in it.</li>
          <li>Features may change or be removed at any time.</li>
        </ul>
        <p style="margin:0 0 1.5rem;font-size:0.8125rem;color:#475569;">See our
          <a href="https://docs.intersectmbo.org/intersect-knowledge-base/legal/policies-and-conditions/intersect-internal-policies/terms-of-use" target="_blank" rel="noopener noreferrer" style="color:#0228aa;font-weight:600;text-decoration:underline;">Terms of Use</a> and
          <a href="https://docs.intersectmbo.org/intersect-knowledge-base/legal/policies-and-conditions/intersect-internal-policies/privacy-policy" target="_blank" rel="noopener noreferrer" style="color:#0228aa;font-weight:600;text-decoration:underline;">Privacy Policy</a> for details.</p>
        <button onclick="document.getElementById('alpha-info-backdrop').remove()"
          style="width:100%;padding:0.875rem;border-radius:0.75rem;border:none;background:#0228aa;color:white;font-weight:700;font-size:0.9375rem;font-family:'Poppins',sans-serif;cursor:pointer;">Got it</button>
      </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
};

// Alpha-agreement acceptance is recorded server-side per account (see
// /alpha-agreement/accept); the auth responses expose `alpha_agreed` so the
// client knows whether to show the agreement.

function showAlphaAgreement() {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.id = 'alpha-agreement';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:1rem;';
        overlay.innerHTML = `
            <div style="background:white;border-radius:1.5rem;max-width:560px;width:100%;padding:2.5rem;box-shadow:0 25px 60px rgba(0,0,0,0.3);">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
                    <span style="background:#ff5722;color:white;font-size:10px;font-weight:800;letter-spacing:.08em;padding:3px 10px;border-radius:999px;text-transform:uppercase;">Alpha</span>
                    <h2 style="margin:0;font-size:1.25rem;font-weight:700;color:#0f172a;font-family:'Poppins',sans-serif;">User Agreement</h2>
                </div>
                <p style="margin:0 0 1rem;font-size:0.875rem;font-weight:600;color:#334155;font-family:'Poppins',sans-serif;">Alpha Release Acknowledgement</p>
                <p style="margin:0 0 1rem;font-size:0.8125rem;color:#475569;font-family:'Poppins',sans-serif;">This tool is an <strong>alpha release</strong> and is made available for testing and feedback purposes only.</p>
                <p style="margin:0 0 0.5rem;font-size:0.8125rem;color:#475569;font-family:'Poppins',sans-serif;">By continuing, you acknowledge and agree that:</p>
                <ul style="margin:0 0 1.25rem;padding-left:1.25rem;font-size:0.8125rem;color:#475569;font-family:'Poppins',sans-serif;line-height:1.7;">
                    <li>This is an early version of the software and may contain bugs, errors, security vulnerabilities, or incomplete features.</li>
                    <li>The tool may be unavailable, unstable, or experience unexpected interruptions or data loss.</li>
                    <li>We do not guarantee the accuracy, reliability, performance, or availability of the tool.</li>
                    <li>You use this tool at your own risk and should not rely on it for critical or business-critical activities.</li>
                    <li>You should not upload or store confidential, sensitive, or irreplaceable information in the tool.</li>
                    <li>Features and functionality may change or be removed at any time without notice.</li>
                    <li>We may collect usage data and feedback to improve the product, in accordance with our <a href="https://docs.intersectmbo.org/intersect-knowledge-base/legal/policies-and-conditions/intersect-internal-policies/privacy-policy" target="_blank" rel="noopener noreferrer" style="color:#0228aa;font-weight:600;text-decoration:underline;">Privacy Policy</a>.</li>
                </ul>
                <p style="margin:0 0 1.25rem;font-size:0.8125rem;color:#475569;font-family:'Poppins',sans-serif;">By continuing, you also agree to our <a href="https://docs.intersectmbo.org/intersect-knowledge-base/legal/policies-and-conditions/intersect-internal-policies/terms-of-use" target="_blank" rel="noopener noreferrer" style="color:#0228aa;font-weight:600;text-decoration:underline;">Terms of Use</a>.</p>
                <label style="display:flex;align-items:flex-start;gap:0.625rem;cursor:pointer;margin-bottom:1.5rem;">
                    <input type="checkbox" id="alpha-checkbox" style="margin-top:2px;accent-color:#0228aa;width:16px;height:16px;flex-shrink:0;">
                    <span style="font-size:0.8125rem;color:#334155;font-family:'Poppins',sans-serif;font-weight:500;">I have read and understand that this is an alpha release, and I accept the above terms.</span>
                </label>
                <button id="alpha-agree-btn" disabled
                    style="width:100%;padding:0.875rem;border-radius:0.75rem;border:none;background:#cbd5e1;color:#94a3b8;font-weight:700;font-size:0.9375rem;font-family:'Poppins',sans-serif;cursor:not-allowed;transition:all .2s;">
                    I Agree
                </button>
            </div>`;
        document.body.appendChild(overlay);

        const checkbox = overlay.querySelector('#alpha-checkbox');
        const btn = overlay.querySelector('#alpha-agree-btn');
        checkbox.addEventListener('change', () => {
            btn.disabled = !checkbox.checked;
            btn.style.background = checkbox.checked ? '#0228aa' : '#cbd5e1';
            btn.style.color = checkbox.checked ? 'white' : '#94a3b8';
            btn.style.cursor = checkbox.checked ? 'pointer' : 'not-allowed';
        });
        btn.addEventListener('click', () => {
            // The caller records acceptance server-side; the modal just resolves
            // once the user accepts.
            overlay.remove();
            resolve();
        });
    });
}

async function init() {
    state.loading.init = true;

    // Restore session if token exists
    const session = getSavedSession();
    if (session?.token && session.token !== 'dev-token-' + session.stake_address) {
        try {
            const me = await getMe();
            state.user = me;
        } catch {
            logout();
        }
    } else if (session?.token?.startsWith('dev-token-')) {
        // Restore dev session
        state.user = {
            stake_address: session.stake_address,
            display_name: session.display_name,
            is_editor: true,
            is_admin: false,
        };
    }

    state.loading.init = false;
    window.addEventListener('hashchange', window.handleRouting);
    await window.handleRouting();
    if (state.user) {
        // A restored session whose account has no server-side acceptance record
        // still sees the agreement once (dev sessions have no such field → skip).
        if (state.user.alpha_agreed === false) {
            await showAlphaAgreement();
            try { await acceptAlphaAgreement(); } catch (_) { /* recorded on next login */ }
            state.user.alpha_agreed = true;
        }
        refreshUnreadCount();
    }
}

init();

// ── Bug Reports ───────────────────────────────────────────────────────────────

window.openBugReportModal = () => {
    const existing = document.getElementById('bug-report-modal');
    if (existing) existing.remove();

    // Capture environment at the moment the modal opens
    window._bugEnv = {
        page: window.location.hash || window.location.pathname,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
        user_agent: navigator.userAgent,
        logged_in: !!state.user,
        username: state.user?.display_name || state.user?.stake_address || null,
        timestamp: new Date().toISOString(),
    };

    const div = document.createElement('div');
    div.innerHTML = `
    <div id="bug-report-modal"
         onclick="if(event.target===this) document.getElementById('bug-report-modal').remove()"
 class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-md p-6 sm:p-8">
 <div class="flex items-center justify-between mb-6">
 <div class="flex items-center gap-3">
 <div class="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center">
 <i data-lucide="bug" class="w-5 h-5 text-red-500"></i>
                    </div>
 <h2 class="text-xl font-black text-slate-900 ">Report a Bug</h2>
                </div>
                <button onclick="document.getElementById('bug-report-modal').remove()"
 class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
 <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

 <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Title</label>
            <input id="bug-title" type="text" placeholder="Short summary of the issue" maxlength="120"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-400 mb-4 font-medium">

 <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Description</label>
            <textarea id="bug-description" rows="4" placeholder="What happened? What did you expect? Steps to reproduce…"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-400 mb-4 font-medium resize-none"></textarea>

 <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
 Screenshot <span class="text-slate-400 font-normal normal-case tracking-normal">— optional</span>
            </label>
 <label class="flex flex-col items-center justify-center w-full h-24 rounded-2xl border-2 border-dashed border-slate-200 hover:border-red-300 cursor-pointer transition-colors mb-1" id="bug-screenshot-label">
 <i data-lucide="image-plus" class="w-6 h-6 text-slate-400 mb-1"></i>
 <span class="text-xs text-slate-400">Click to attach or paste an image</span>
 <input id="bug-screenshot-input" type="file" accept="image/*" class="hidden" onchange="window._bugScreenshotPicked(this)">
            </label>
 <div id="bug-screenshot-preview" class="hidden mb-4 relative">
 <img id="bug-screenshot-img" src="" class="w-full rounded-2xl border border-slate-200 max-h-40 object-contain">
 <button onclick="window._bugScreenshotClear()" class="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
 <i data-lucide="x" class="w-3 h-3"></i>
                </button>
            </div>

 <div id="bug-error" class="hidden text-red-500 text-sm font-bold mb-4"></div>

            <button onclick="window._submitBugReport()"
 class="w-full py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black transition-colors">
                Submit Report
            </button>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
    document.getElementById('bug-title')?.focus();
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window._bugScreenshotPicked = (input) => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('bug-screenshot-img');
        const preview = document.getElementById('bug-screenshot-preview');
        const label = document.getElementById('bug-screenshot-label');
        if (img) img.src = e.target.result;
        preview?.classList.remove('hidden');
        label?.classList.add('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };
    reader.readAsDataURL(file);
};

window._bugScreenshotClear = () => {
    const input = document.getElementById('bug-screenshot-input');
    const img = document.getElementById('bug-screenshot-img');
    const preview = document.getElementById('bug-screenshot-preview');
    const label = document.getElementById('bug-screenshot-label');
    if (input) input.value = '';
    if (img) img.src = '';
    preview?.classList.add('hidden');
    label?.classList.remove('hidden');
};

window._submitBugReport = async () => {
    const title = document.getElementById('bug-title')?.value?.trim();
    const description = document.getElementById('bug-description')?.value?.trim();
    const screenshot = document.getElementById('bug-screenshot-img')?.src || null;
    const errEl = document.getElementById('bug-error');

    if (!title) {
        errEl.textContent = 'Please enter a title.';
        errEl.classList.remove('hidden');
        return;
    }
    if (!description) {
        errEl.textContent = 'Please describe the bug.';
        errEl.classList.remove('hidden');
        return;
    }

    const screenshotData = screenshot?.startsWith('data:') ? screenshot : null;
    const environment = window._bugEnv || null;

    try {
        await submitBugReport(title, description, screenshotData, environment);
        document.getElementById('bug-report-modal')?.remove();
    } catch (e) {
        errEl.textContent = e.message || 'Failed to submit. Please try again.';
        errEl.classList.remove('hidden');
    }
};

window.updateBugStatus = async (id, status) => {
    try {
        await updateBugStatus(id, status);
        await loadBugReports();
    } catch (e) {
        alert('Failed to update status: ' + e.message);
    }
};

// ── Guide Editor ──────────────────────────────────────────────────────────────

const _guideToolbar = [
    { label: 'H1',  title: 'Heading 1',      action: () => _guideWrap('# ',       ''    ) },
    { label: 'H2',  title: 'Heading 2',      action: () => _guideWrap('## ',      ''    ) },
    { label: 'H3',  title: 'Heading 3',      action: () => _guideWrap('### ',     ''    ) },
    { label: '|',   title: null,             action: null },
    { label: 'B',   title: 'Bold',           action: () => _guideWrap('**',       '**'  ) },
    { label: 'I',   title: 'Italic',         action: () => _guideWrap('_',        '_'   ) },
    { label: '|',   title: null,             action: null },
    { label: '—',   title: 'Bullet list',    action: () => _guideWrap('- ',       ''    ) },
    { label: '1.',  title: 'Numbered list',  action: () => _guideWrap('1. ',      ''    ) },
    { label: '|',   title: null,             action: null },
    { label: '<>',  title: 'Inline code',    action: () => _guideWrap('`',        '`'   ) },
    { label: '```', title: 'Code block',     action: () => _guideWrap('```\n',    '\n```') },
    { label: '|',   title: null,             action: null },
    { label: '🔗',  title: 'Link',           action: () => _guideInsertLink()             },
    { label: 'hr',  title: 'Divider',        action: () => _guideInsertAtLineStart('---\n') },
];

function _guideWrap(before, after) {
    const ta = document.getElementById('guide-editor-content');
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    const replacement = before + (selected || 'text') + after;
    ta.setRangeText(replacement, start, end, 'select');
    ta.focus();
    _guideUpdatePreview();
}

function _guideInsertAtLineStart(text) {
    const ta = document.getElementById('guide-editor-content');
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
    ta.setRangeText(text, lineStart, lineStart, 'start');
    ta.focus();
    _guideUpdatePreview();
}

function _guideInsertLink() {
    const ta = document.getElementById('guide-editor-content');
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const selected = ta.value.slice(start, end) || 'link text';
    ta.setRangeText(`[${selected}](url)`, start, end, 'select');
    ta.focus();
    _guideUpdatePreview();
}

function _guideUpdatePreview() {
    const ta = document.getElementById('guide-editor-content');
    const preview = document.getElementById('guide-editor-preview');
    if (!ta || !preview) return;
    preview.innerHTML = window.safeMarkdown(ta.value);
}

window.openGuideEditor = () => {
    const slug = state.activeGuide;
    const existing = document.getElementById('guide-editor-modal');
    if (existing) existing.remove();

    const defaultTitle = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const currentContent = state.guideRawContent || '';

    const toolbarHtml = _guideToolbar.map(btn => {
 if (btn.label === '|') return `<span class="w-px h-5 bg-slate-200 mx-1 shrink-0"></span>`;
        return `<button type="button" title="${btn.title}" onclick="window._guideTbAction('${btn.title}')"
 class="px-2 py-1 rounded-lg text-xs font-black text-slate-600 hover:bg-amber-100 hover:text-amber-700 transition-colors shrink-0">${btn.label}</button>`;
    }).join('');

    const div = document.createElement('div');
    div.innerHTML = `
    <div id="guide-editor-modal"
 class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col" style="width:min(96vw,1100px);max-height:92vh">

            <!-- Header -->
 <div class="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
 <div class="flex items-center gap-3">
 <div class="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center">
 <i data-lucide="pencil" class="w-5 h-5 text-amber-600"></i>
                    </div>
                    <div>
 <h2 class="text-xl font-black text-slate-900 ">Edit Guide</h2>
 <p class="text-xs text-slate-400 font-mono">${slug}</p>
                    </div>
                </div>
                <button onclick="document.getElementById('guide-editor-modal').remove()"
 class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
 <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Title -->
 <div class="px-8 pb-3 shrink-0">
                <input id="guide-editor-title" type="text" value="${defaultTitle.replace(/"/g, '&quot;')}" maxlength="120"
                    placeholder="Guide title"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 focus:outline-none focus:border-amber-400 font-bold text-lg">
            </div>

            <!-- Toolbar -->
 <div class="px-8 pb-2 shrink-0">
 <div class="flex items-center flex-wrap gap-0.5 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100 ">
                    ${toolbarHtml}
                </div>
            </div>

            <!-- Split pane -->
 <div class="px-8 flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 pb-2">
 <div class="flex flex-col min-h-0">
 <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Write</p>
                    <textarea id="guide-editor-content"
                        oninput="window._guideUpdatePreview()"
 class="flex-1 w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 font-mono text-sm focus:outline-none focus:border-amber-400 resize-none"
                        placeholder="Start writing…">${currentContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
 <div class="flex flex-col min-h-0">
 <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Preview</p>
                    <div id="guide-editor-preview"
 class="flex-1 overflow-y-auto px-4 py-3 rounded-2xl border-2 border-slate-100 bg-slate-50 prose max-w-none text-sm">
                    </div>
                </div>
            </div>

            <!-- Footer -->
 <div class="px-8 py-5 shrink-0">
 <div id="guide-editor-error" class="hidden text-red-500 text-sm font-bold mb-3"></div>
 <div class="flex gap-3">
                    <button onclick="window._saveGuide()"
 class="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black transition-colors">
                        Save Guide
                    </button>
                    <button onclick="document.getElementById('guide-editor-modal').remove()"
 class="px-6 py-3 rounded-2xl border-2 border-slate-200 text-slate-500 font-black hover:border-slate-400 transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    // Wire up toolbar actions
    window._guideTbAction = (title) => {
        const btn = _guideToolbar.find(b => b.title === title);
        if (btn?.action) btn.action();
    };
    window._guideUpdatePreview = _guideUpdatePreview;
    // Render initial preview
    _guideUpdatePreview();
    document.getElementById('guide-editor-title')?.focus();
};

window._saveGuide = async () => {
    const slug = state.activeGuide;
    const title = document.getElementById('guide-editor-title')?.value?.trim();
    const content = document.getElementById('guide-editor-content')?.value;
    const errEl = document.getElementById('guide-editor-error');

    if (!title) {
        errEl.textContent = 'Please enter a title.';
        errEl.classList.remove('hidden');
        return;
    }
    if (!content?.trim()) {
        errEl.textContent = 'Content cannot be empty.';
        errEl.classList.remove('hidden');
        return;
    }

    const btn = document.querySelector('#guide-editor-modal button[onclick="window._saveGuide()"]');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

    try {
        const guideInfo = state.guides.find(g => g.slug === slug);
        await upsertGuide(slug, title, content, guideInfo?.section || 'general', guideInfo?.section_label || null, guideInfo?.sort_order || 0);
        document.getElementById('guide-editor-modal').remove();
        // Reload the guide and refresh guide list
        state.guideHtml = null;
        state.guidesLoaded = false;
        updateUI();
        window.openGuide(slug);
    } catch (e) {
        if (btn) { btn.textContent = 'Save Guide'; btn.disabled = false; }
        errEl.textContent = e.message || 'Failed to save. Please try again.';
        errEl.classList.remove('hidden');
    }
};
