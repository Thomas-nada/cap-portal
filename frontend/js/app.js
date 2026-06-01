import { fetchAllProposals, fetchProposal, fetchComments, fetchAudit,
         createProposal, updateProposal, addLabel, removeLabel,
         withdrawProposal, cancelWithdrawal,
         createComment, updateComment,
         fetchConstitutionVersions, fetchConstitutionContent,
         fetchEditors, addEditor, removeEditor, claimFirstEditor,
         fetchAdmins, addAdmin, removeAdmin, claimFirstAdmin,
         fetchSuggestions, createSuggestion, approveSuggestion, rejectSuggestion,
         fetchVersions, fetchVersion,
         getMe, devSeedEditor, setDisplayName, updateProfile,
         generateDraftConstitution, subscribeToProposal, checkSubscription, unsubscribeFromProposal,
         submitBugReport, fetchBugReports, updateBugStatus,
         fetchGuides, fetchGuide, upsertGuide, deleteGuide } from './api.js';

import { connectAndAuth, logout, getSavedSession, renderWalletModal,
         showDisplayNameStep, devLogin, shortAddress,
         getAvailableWallets } from './wallet.js';

import { DEV_MODE, API_BASE } from './config.js';

import { renderNav }          from './components/nav.js';
import { renderDashboard }    from './components/dashboard.js';
import { renderRegistry }     from './components/registry.js';
import { renderKanban }       from './components/kanban.js';
import { renderDetail }       from './components/detail.js';
import { renderWizard, validateStep, isStepSkipped } from './components/wizard.js';
import { renderCreate }       from './components/create.js';
import { renderEdit }         from './components/edit.js';
import { renderConstitution } from './components/constitution.js';
import { renderLearnHub as renderLearn } from './components/learn.js';
import { renderEditors }      from './components/editors.js';
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
    suggestions: [],
    proposalVersions: [],
    constitutionVersions: [],        // [{name, filename, isCurrent, content}]
    constitutionCurrentVersion: null, // version name string
    constitutionCompareVersion: null, // version name string or null
    // UI
    view: 'dashboard',
    loading: { init: true, proposals: false, proposal: false },
    error: null,
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
    // Create / Edit
    draftProposal: {},
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
        case 'create':       content = renderCreate(state); break;
        case 'edit':         content = renderEdit(state); break;
        case 'constitution': content = renderConstitution(state); break;
        case 'learn':        content = renderLearn(state); break;
        case 'editors':      content = renderEditors(state); break;
        case 'bugs':         content = renderBugs(state); break;
        default:             content = renderDashboard(state);
    }

    root.innerHTML = nav + `
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            ${content}
        </main>
        ${state.user ? `
        <button onclick="window.openBugReportModal()" title="Report a bug"
            class="fixed bottom-6 right-6 z-40 w-14 h-14 bg-red-500 hover:bg-red-600 active:scale-95 text-white rounded-full shadow-xl flex items-center justify-center transition-all">
            <i data-lucide="bug" class="w-6 h-6"></i>
        </button>` : ''}`;

    lucide.createIcons();
    if (window.fixPreCode) window.fixPreCode();
}

window.updateUI = updateUI;

// ── Navigation ────────────────────────────────────────────────────────────────

window.setView = (view) => {
    state.view = view;
    const map = {
        dashboard: '#/home', list: '#/registry', kanban: '#/kanban',
        constitution: '#/constitution', create: '#/create',
        wizard: '#/wizard', learn: '#/learn', editors: '#/editors', bugs: '#/bugs',
    };
    if (map[view]) window.location.hash = map[view];
    updateUI();
};

window.handleRouting = async () => {
    const hash = window.location.hash || '#/home';
    state.error = null;

    if (hash === '#/home' || hash === '#/') {
        state.view = 'dashboard';
        loadProposals();
    } else if (hash === '#/registry') {
        state.view = 'list';
        loadProposals();
    } else if (hash === '#/kanban') {
        state.view = 'kanban';
        loadProposals();
    } else if (hash === '#/constitution') {
        state.view = 'constitution';
        loadConstitution();
    } else if (hash === '#/create') {
        state.view = 'create';
        updateUI();
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
    } else if (hash.startsWith('#/learn/')) {
        const slug = hash.replace('#/learn/', '');
        state.view = 'learn';
        if (slug) {
            if (!state.guidesLoaded) loadGuides().then(() => window.openGuide(slug));
            else window.openGuide(slug);
        } else {
            if (!state.guidesLoaded) loadGuides();
            else updateUI();
        }
    } else if (hash === '#/learn') {
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
    const LIFECYCLE = ['consultation', 'ready', 'done', 'withdrawn'];
    const stageOf = p => {
        const lc = (p.labels || []).map(l => l.name.toLowerCase());
        for (const s of LIFECYCLE) { if (lc.includes(s)) return s; }
        return p.state === 'closed' ? 'done' : 'consultation';
    };
    const caps = state.proposals.filter(p => p.type !== 'CIS');
    state.stats = {
        consultation: caps.filter(p => stageOf(p) === 'consultation').length,
        ready:        caps.filter(p => stageOf(p) === 'ready').length,
        done:         caps.filter(p => stageOf(p) === 'done').length,
    };
}

async function loadConstitution() {
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
        state.subscribeSuccess = false;
        state.isSubscribed = false;
        const email = state.user?.email;
        if (email) {
            checkSubscription(number, email).then(r => {
                state.isSubscribed = r.subscribed;
                updateUI();
            }).catch(() => {});
        }
        if (addToHistory) window.location.hash = `#/detail/${number}`;
    } catch (e) {
        state.error = e.message;
    } finally {
        state.loading.proposal = false;
        updateUI();
    }
};

window.submitProposal = async () => {
    if (!state.user) { showWalletModal(); return; }
    const draft = state.draftProposal;
    if (!draft.title?.trim() || !draft.body?.trim()) {
        state.error = 'Title and body are required';
        updateUI();
        return;
    }
    try {
        const proposal = await createProposal({
            title: draft.title,
            body: draft.body,
            type: draft.type || 'CAP',
        });
        state.draftProposal = {};
        await window.openProposal(proposal.number);
    } catch (e) {
        state.error = e.message;
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
    try {
        const proposal = await createProposal({ title, type: w.type || 'CAP', structured });
        await addLabel(proposal.number, proposal.type);
        if (w.category) await addLabel(proposal.number, w.category);
        // Generate draft constitution if proposal includes revisions
        const hasRevisions = structured.revisions?.some(r => (r.original && r.proposed) || (r.insert_after && r.proposed));
        if (hasRevisions) {
            try { await generateDraftConstitution(proposal.number); } catch (_) {}
        }
        state.wizardData = {};
        state.wizardStep = 1;
        await window.openProposal(proposal.number);
    } catch (e) {
        state.error = e.message;
        updateUI();
    }
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

window.followProposalAsUser = async () => {
    const email = state.user?.email;
    const number = state.currentProposal?.number;
    if (!email || !number) return;
    state.loading = { ...state.loading, followProposal: true };
    updateUI();
    try {
        await subscribeToProposal(number, email);
        state.isSubscribed = true;
        state.subscribeSuccess = true;
    } catch (e) {
        state.error = e.message;
    } finally {
        state.loading = { ...state.loading, followProposal: false };
        updateUI();
    }
};

window.unfollowProposalAsUser = async () => {
    const email = state.user?.email;
    const number = state.currentProposal?.number;
    if (!email || !number) return;
    state.loading = { ...state.loading, followProposal: true };
    updateUI();
    try {
        await unsubscribeFromProposal(number, email);
        state.isSubscribed = false;
        state.subscribeSuccess = false;
    } catch (e) {
        state.error = e.message;
    } finally {
        state.loading = { ...state.loading, followProposal: false };
        updateUI();
    }
};

window.followProposal = async (form) => {
    const email = new FormData(form).get('email')?.trim();
    const number = state.currentProposal?.number;
    if (!email || !number) return;
    state.loading = { ...state.loading, followProposal: true };
    updateUI();
    try {
        await subscribeToProposal(number, email);
        state.subscribeSuccess = true;
        state.isSubscribed = true;
        form.reset();
    } catch (e) {
        state.error = e.message;
    } finally {
        state.loading = { ...state.loading, followProposal: false };
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
    const renderMd = text => window.marked ? window.marked.parse(String(text || '')) : `<p>${esc(text)}</p>`;

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
            <div class="rounded-2xl border border-cyan-100 dark:border-cyan-900/40 overflow-hidden mb-4">
                ${r.section ? `<div class="px-5 py-2 bg-cyan-50 dark:bg-cyan-900/20 text-xs font-black text-cyan-500 uppercase tracking-widest">${esc(r.section)}</div>` : ''}
                <div class="grid grid-cols-2 divide-x divide-cyan-100 dark:divide-cyan-900/30">
                    <div class="p-5"><div class="text-[10px] font-black uppercase tracking-widest text-cyan-500 mb-2">Insert After</div>
                        <div class="text-sm text-slate-600 dark:text-slate-400 font-mono leading-relaxed italic">${esc(r.insert_after || '')}</div></div>
                    <div class="p-5"><div class="text-[10px] font-black uppercase tracking-widest text-cyan-600 mb-2">New Text</div>
                        <div class="text-sm text-slate-900 dark:text-white font-mono leading-relaxed">${esc(r.proposed || '')}</div></div>
                </div>
            </div>` : `
            <div class="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden mb-4">
                ${r.section ? `<div class="px-5 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs font-black text-slate-400 uppercase tracking-widest">${esc(r.section)}</div>` : ''}
                <div class="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
                    <div class="p-5"><div class="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Original</div>
                        <div class="text-sm text-slate-600 dark:text-slate-400 font-mono leading-relaxed">${esc(r.original || '')}</div></div>
                    <div class="p-5"><div class="text-[10px] font-black uppercase tracking-widest text-green-500 mb-2">Proposed</div>
                        <div class="text-sm text-slate-900 dark:text-white font-mono leading-relaxed">${esc(r.proposed || '')}</div></div>
                </div>
            </div>`).join('');
        };

        // Full view — identical structure to the proposal detail
        const fullSections = [];
        if (s.abstract)   fullSections.push(`<h2 class="text-xl font-black text-slate-900 dark:text-white mt-2 mb-3">${isCIS ? 'Summary' : 'Summary'}</h2><div class="prose dark:prose-invert max-w-none text-sm">${renderMd(s.abstract)}</div>`);
        if (s.motivation) fullSections.push(`<h2 class="text-xl font-black text-slate-900 dark:text-white mt-2 mb-3">${isCIS ? 'Problem' : 'Why is this change needed?'}</h2><div class="prose dark:prose-invert max-w-none text-sm">${renderMd(s.motivation)}</div>`);
        if (s.analysis)   fullSections.push(`<h2 class="text-xl font-black text-slate-900 dark:text-white mt-2 mb-3">${isCIS ? 'Context' : 'Analysis &amp; Test'}</h2><div class="prose dark:prose-invert max-w-none text-sm">${renderMd(s.analysis)}</div>`);
        if (s.impact)     fullSections.push(`<h2 class="text-xl font-black text-slate-900 dark:text-white mt-2 mb-3">Impact</h2><div class="prose dark:prose-invert max-w-none text-sm">${renderMd(s.impact)}</div>`);
        if (s.revisions?.length) fullSections.push(`<h2 class="text-xl font-black text-slate-900 dark:text-white mt-2 mb-3">Proposed Revisions</h2>${renderRevisions(s.revisions)}`);
        if (s.exhibits)   fullSections.push(`<h2 class="text-xl font-black text-slate-900 dark:text-white mt-2 mb-3">Links &amp; Files</h2><div class="prose dark:prose-invert max-w-none text-sm">${renderMd(s.exhibits)}</div>`);
        const fullContent = `<h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-6">${esc(v.title)}</h1>` + fullSections.join('<hr class="border-slate-100 dark:border-slate-800 my-4">');

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
                    ${changed ? `<span class="text-[8px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">Changed</span>` : `<span class="text-[8px] text-slate-300 dark:text-slate-600 font-bold">Unchanged</span>`}
                </div>
                <div class="text-sm leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">${diffHtml}</div>
            </div>`;
        }).join('<hr class="border-slate-100 dark:border-slate-800 my-2">');

        const hasPrev = !!prev;

        const div = document.createElement('div');
        div.innerHTML = `
        <div id="version-modal-backdrop"
             onclick="if(event.target===this) document.getElementById('version-modal-backdrop').remove()"
             class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

                <!-- Header -->
                <div class="flex items-start justify-between p-8 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <div>
                        <div class="flex items-center gap-3 mb-1">
                            <span class="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-widest">V${v.version}</span>
                            <span class="text-[10px] text-slate-400 font-bold">${when}</span>
                            <span class="text-[10px] text-slate-400">· ${esc(v.created_by_name || v.created_by)}</span>
                        </div>
                        <p class="text-sm font-black text-slate-900 dark:text-white mt-1">${esc(v.title)}</p>
                        <p class="text-[10px] text-slate-400 mt-0.5 italic">${esc(v.change_summary || '')}</p>
                    </div>
                    <button onclick="document.getElementById('version-modal-backdrop').remove()"
                        class="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all ml-4">
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
                        class="px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
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
            document.getElementById('ver-tab-full').className = `px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'full' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`;
            const diffBtn = document.getElementById('ver-tab-diff');
            if (diffBtn) diffBtn.className = `px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'diff' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`;
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
        <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-2xl p-8">
            <div class="flex items-center justify-between mb-6">
                <div>
                    <p class="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Suggest Change</p>
                    <h2 class="text-xl font-black text-slate-900 dark:text-white">${label}</h2>
                </div>
                <button onclick="document.getElementById('suggest-modal-backdrop').remove()"
                    class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            ${current ? `
            <div class="mb-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Current</p>
                <div class="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-sm text-slate-500 dark:text-slate-400 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">${escHtml(current)}</div>
            </div>` : ''}
            <div class="mb-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Suggested Value</p>
                <textarea id="suggest-value" rows="6" placeholder="Enter your suggested text…"
                    class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-blue-500 outline-none resize-none transition-all">${escHtml(current)}</textarea>
            </div>
            <div class="mb-6">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Reason <span class="text-slate-300">(optional)</span></p>
                <input id="suggest-reason" type="text" placeholder="Why are you suggesting this change?"
                    class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-blue-500 outline-none transition-all">
            </div>
            <p id="suggest-error" class="text-red-500 text-xs font-bold mb-3 hidden"></p>
            <div class="flex gap-3">
                <button onclick="window.submitSuggestion('${field}')"
                    class="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-colors">
                    Submit Suggestion
                </button>
                <button onclick="document.getElementById('suggest-modal-backdrop').remove()"
                    class="px-6 py-3 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-black transition-colors">
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

// ── Create form helpers ───────────────────────────────────────────────────────

window.setCreateType = (type) => {
    state.draftProposal = { ...state.draftProposal, type };
    updateUI();
};

window.updateDraftField = (field, value) => {
    state.draftProposal = { ...state.draftProposal, [field]: value };
};

window.removeReference = (id) => {
    const refs = (state.draftProposal.references || []).filter(r => r.id !== id);
    state.draftProposal = { ...state.draftProposal, references: refs };
    updateUI();
};

// ── Preview overlay ───────────────────────────────────────────────────────────

function buildPreviewHtml(title, structured, type) {
    const isCIS = type === 'CIS';
    const md = text => window.marked ? window.marked.parse(String(text || '')) : `<p>${String(text || '')}</p>`;
    const esc = str => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const sections = [];
    if (structured.abstract)
        sections.push(`<h2 class="text-2xl font-black text-slate-900 dark:text-white mt-10 mb-4">Summary</h2><div class="prose dark:prose-invert max-w-none">${md(structured.abstract)}</div>`);

    if (isCIS) {
        if (structured.motivation)
            sections.push(`<h2 class="text-2xl font-black text-slate-900 dark:text-white mt-10 mb-4">Problem</h2><div class="prose dark:prose-invert max-w-none">${md(structured.motivation)}</div>`);
        if (structured.analysis)
            sections.push(`<h2 class="text-2xl font-black text-slate-900 dark:text-white mt-10 mb-4">Context</h2><div class="prose dark:prose-invert max-w-none">${md(structured.analysis)}</div>`);
        if (structured.impact)
            sections.push(`<h2 class="text-2xl font-black text-slate-900 dark:text-white mt-10 mb-4">Impact</h2><div class="prose dark:prose-invert max-w-none">${md(structured.impact)}</div>`);
    } else {
        if (structured.motivation)
            sections.push(`<h2 class="text-2xl font-black text-slate-900 dark:text-white mt-10 mb-4">Why is this change needed?</h2><div class="prose dark:prose-invert max-w-none">${md(structured.motivation)}</div>`);
        if (structured.analysis)
            sections.push(`<h2 class="text-2xl font-black text-slate-900 dark:text-white mt-10 mb-4">Analysis &amp; Test</h2><div class="prose dark:prose-invert max-w-none">${md(structured.analysis)}</div>`);
    }

    if (structured.revisions?.length) {
        const rows = structured.revisions.filter(r => r.original || r.insert_after || r.proposed).map(r =>
            r.type === 'addition' ? `
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800/30 rounded-2xl p-5">
                    <p class="text-[10px] font-black uppercase tracking-widest text-cyan-500 mb-2">Insert After — ${esc(r.section || '')}</p>
                    <p class="text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed">${esc(r.insert_after)}</p>
                </div>
                <div class="bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800/30 rounded-2xl p-5">
                    <p class="text-[10px] font-black uppercase tracking-widest text-cyan-600 mb-2">New Text</p>
                    <div class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed prose dark:prose-invert max-w-none">${md(r.proposed)}</div>
                </div>
            </div>` : `
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-2xl p-5">
                    <p class="text-[10px] font-black uppercase tracking-widest text-red-500 mb-2">Original — ${esc(r.section || '')}</p>
                    <p class="text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed">${esc(r.original)}</p>
                </div>
                <div class="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-2xl p-5">
                    <p class="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2">Proposed</p>
                    <div class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed prose dark:prose-invert max-w-none">${md(r.proposed)}</div>
                </div>
            </div>`).join('');
        sections.push(`<h2 class="text-2xl font-black text-slate-900 dark:text-white mt-10 mb-4">Structured Revisions</h2>${rows}`);
    }

    if (structured.exhibits)
        sections.push(`<h2 class="text-2xl font-black text-slate-900 dark:text-white mt-10 mb-4">Links &amp; Files</h2><div class="prose dark:prose-invert max-w-none">${md(structured.exhibits)}</div>`);

    return `
        <div class="flex items-center justify-between mb-8 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl sticky top-4 z-10 backdrop-blur-sm">
            <div class="flex items-center gap-3">
                <i data-lucide="eye" class="w-4 h-4 text-amber-600"></i>
                <span class="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Preview — Not Yet Submitted</span>
            </div>
            <button onclick="window.closePreview()" class="flex items-center gap-2 text-sm font-black text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60">
                <i data-lucide="x" class="w-4 h-4"></i> Close
            </button>
        </div>
        <div class="bg-white dark:bg-slate-900 p-10 sm:p-20 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div class="flex flex-wrap gap-3 mb-8">
                <span class="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">${esc(type)}</span>
                ${structured.category ? `<span class="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">${esc(structured.category)}</span>` : ''}
            </div>
            <h1 class="text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-8">${esc(title || 'Untitled')}</h1>
            ${sections.join('\n')}
        </div>`;
}

window.previewCreate = () => {
    const form = document.getElementById('create-form');
    if (!form) return;
    const fd = new FormData(form);
    const draft = state.draftProposal || {};
    const type = draft.type || 'CAP';
    const refs = state.selectedReferences || [];
    const structured = {
        type,
        category: fd.get('category') || '',
        abstract: fd.get('abstract') || '',
        motivation: fd.get('motivation') || '',
        analysis: fd.get('analysis') || '',
        impact: fd.get('impact') || '',
        exhibits: fd.get('specification_extra') || '',
        revisions: refs.map(ref => ({
            original: ref.text,
            section: ref.section,
            proposed: fd.get(`ref-input-${ref.id}`) || '',
        })),
    };
    showPreviewOverlay(fd.get('title') || '', structured, type);
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
    overlay.className = 'fixed inset-0 z-[200] bg-slate-50 dark:bg-slate-950 overflow-y-auto';
    overlay.innerHTML = `<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">${buildPreviewHtml(title, structured, type)}</div>`;
    document.body.appendChild(overlay);
    lucide.createIcons();
    overlay.scrollTop = 0;
}

window.closePreview = () => {
    const overlay = document.getElementById('preview-overlay');
    if (overlay) overlay.remove();
};

window.handleForm = async (event) => {
    event.preventDefault();
    if (!state.user) { showWalletModal(); return; }
    const fd = new FormData(event.target);
    const draft = state.draftProposal;
    const type = draft.type || 'CAP';
    const title = fd.get('title') || '';
    const abstract   = fd.get('abstract') || '';
    const motivation = fd.get('motivation') || '';
    const analysis   = fd.get('analysis') || '';
    const impact     = fd.get('impact') || '';
    const exhibits   = fd.get('specification_extra') || '';
    const category   = fd.get('category') || '';

    if (!title.trim()) { state.error = 'Title is required'; updateUI(); return; }

    const structured = { type, category, abstract, motivation, analysis, impact, exhibits, revisions: [], co_authors: [] };

    state.loading = { ...state.loading, submitting: true };
    updateUI();
    try {
        const proposal = await createProposal({ title, type, structured });
        await addLabel(proposal.number, type);
        if (category) await addLabel(proposal.number, category);
        state.draftProposal = {};
        await window.openProposal(proposal.number);
    } catch (e) {
        state.error = e.message;
        state.loading = { ...state.loading, submitting: false };
        updateUI();
    }
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
            state.user = { stake_address: result.stake_address, display_name: result.display_name, email: result.email, notification_prefs: result.notification_prefs || {}, is_editor: result.is_editor, is_admin: result.is_admin };
            document.getElementById('wallet-modal-backdrop')?.remove();

            // First-time user: no display name in the DB yet — ask for one after signing
            if (!result.display_name) {
                showSetNameModal();
            } else {
                updateUI();
            }
        } catch (e) {
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
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-sm p-8">
                <h2 class="text-xl font-black text-slate-900 dark:text-white mb-2">Choose a display name</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">This is shown on your proposals and comments. You can skip and use your stake address.</p>
                <input id="set-name-input" type="text" placeholder="Display name (optional)" maxlength="40"
                    class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 mb-4 font-medium"
                    onkeydown="if(event.key==='Enter') window._submitSetName()">
                <button onclick="window._submitSetName()"
                    class="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-colors mb-2">
                    Save name
                </button>
                <button onclick="window._skipSetName()"
                    class="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
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
                state.user = { stake_address: result.stake_address, display_name: result.display_name, email: result.email, notification_prefs: result.notification_prefs || {}, is_editor: result.is_editor, is_admin: result.is_admin };
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
    updateUI();
};

window.openProfile = () => {
    const existing = document.getElementById('profile-modal-backdrop');
    if (existing) existing.remove();

    const current = state.user?.display_name || '';
    const currentEmail = state.user?.email || '';
    const addr = state.user?.stake_address || '';
    const prefs = state.user?.notification_prefs || {};
    const isEditor = state.user?.is_editor;
    const isAdmin = state.user?.is_admin;

    const chk = (key, label) => {
        const checked = prefs[key] !== false ? 'checked' : '';
        return `<label class="flex items-center gap-3 cursor-pointer py-2">
            <input type="checkbox" id="pref-${key}" ${checked}
                class="w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0">
            <span class="text-sm text-slate-700 dark:text-slate-300">${label}</span>
        </label>`;
    };

    const div = document.createElement('div');
    div.innerHTML = `
    <div id="profile-modal-backdrop"
         onclick="if(event.target===this) document.getElementById('profile-modal-backdrop').remove()"
         class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-sm p-8 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-black text-slate-900 dark:text-white">Profile</h2>
                <button onclick="document.getElementById('profile-modal-backdrop').remove()"
                        class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <p class="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 mb-6 break-all">${addr}</p>

            <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Display name</label>
            <input id="profile-name-input" type="text" value="${current}" placeholder="Your display name" maxlength="40"
                class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 mb-4 font-medium"
                onkeydown="if(event.key==='Enter') window._saveProfile()">

            <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                Email <span class="text-slate-400 font-normal normal-case tracking-normal">— for notifications (optional)</span>
            </label>
            <input id="profile-email-input" type="email" value="${currentEmail}" placeholder="you@example.com"
                class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 mb-6 font-medium"
                onkeydown="if(event.key==='Enter') window._saveProfile()">

            <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Email notifications</label>
            <div class="bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-2 mb-6 divide-y divide-slate-100 dark:divide-slate-700">
                ${chk('comment_on_my_proposal', 'Comment on my proposal')}
                ${chk('comment_in_thread', 'Reply in a discussion I joined')}
                ${chk('suggestion_received', 'Edit suggestion on my proposal')}
                ${chk('suggestion_resolved', 'My suggestion was approved/rejected')}
                ${chk('lifecycle_change', 'Status change on proposals I follow')}
                ${(isEditor || isAdmin) ? chk('new_proposal', 'New proposal submitted') : ''}
            </div>

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
    const emailInput = document.getElementById('profile-email-input');
    const errEl = document.getElementById('profile-error');
    const name = input?.value.trim() || '';
    const email = emailInput?.value.trim() || null;

    if (!name) {
        if (errEl) { errEl.textContent = 'Display name cannot be empty.'; errEl.classList.remove('hidden'); }
        return;
    }

    const prefKeys = ['comment_on_my_proposal', 'comment_in_thread', 'suggestion_received', 'suggestion_resolved', 'lifecycle_change', 'new_proposal'];
    const notification_prefs = Object.fromEntries(
        prefKeys.map(k => [k, document.getElementById(`pref-${k}`)?.checked ?? true])
    );

    const btn = document.querySelector('#profile-modal-backdrop button.bg-blue-600');
    if (btn) btn.textContent = 'Saving…';

    try {
        const result = await updateProfile(name, email, notification_prefs);
        localStorage.setItem('cap_token', result.token);
        localStorage.setItem('cap_display_name', result.display_name || '');
        state.user = { stake_address: result.stake_address, display_name: result.display_name, email: result.email, notification_prefs: result.notification_prefs, is_editor: result.is_editor, is_admin: result.is_admin };
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
    while (s < 6 && isStepSkipped(s, wizard)) s++;
    return Math.min(s, 6);
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
    state.wizardStep = prevWizardStep(state.wizardStep, state.wizardData || {});
    updateUI();
};
window.wizardNextStep = () => window.wizardNext();
window.wizardPrevStep = () => window.wizardBack();
window.wizardSubmit   = () => window.submitWizard();
window.wizardReset    = () => { state.wizardData = {}; state.wizardStep = 1; state.wizardError = null; updateUI(); };

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
    // Regenerate draft (also fixes any stale/corrupt file from prior runs)
    try { await generateDraftConstitution(proposalNumber); } catch (_) {}
    // Force reload so the newly generated draft file is in the list
    state.constitutionVersions = [];
    state.constitutionCurrentVersion = null;
    state.constitutionCompareVersion = null;
    state.view = 'constitution';
    state.loading = { ...state.loading, constitution: true };
    window.location.hash = '#/constitution';
    updateUI();
    try {
        const raw = await fetchConstitutionVersions();
        state.constitutionVersions = raw.map((v, i) => ({
            name: v.display_name || v.filename.replace('.md', ''),
            filename: v.filename,
            isCurrent: i === 0,
            content: null,
        }));
        const base  = state.constitutionVersions.find(v => !v.filename.startsWith('cap-'));
        const draft = state.constitutionVersions.find(v => v.filename === draftFilename);
        if (!base || !draft) { state.error = 'Draft constitution not found — submit the proposal first.'; updateUI(); return; }
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
    window.location.hash = '#/constitution';
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

function buildWizardMarkdown(w) {
    let md = `---\nCAP: "XXXX"\nTitle: "${w.title || ''}"\nCategory: "${w.category || ''}"\nType: "${w.type || 'CAP'}"\nAuthors:\n  - "${w.coAuthors || ''}"\n---\n\n`;
    md += `## Summary\n${w.abstract || ''}\n\n`;
    if (w.type === 'CAP') {
        md += `## Why is this change needed?\n${w.motivation || ''}\n\n`;
        md += `## Analysis & Test\n${w.analysis || ''}\n\n`;
        if (w.selectedText?.length) {
            md += `## Proposed Revisions\n`;
            w.selectedText.forEach((sel, i) => {
                md += `### Revision ${i + 1}\n**Original:** ${sel.text}\n\n**Proposed:** ${w.revisions?.[i] || ''}\n\n`;
            });
        }
    } else {
        md += `## Problem\n${w.motivation || ''}\n\n`;
        md += `## Context\n${w.analysis || ''}\n\n`;
        if (w.impact) md += `## Impact\n${w.impact}\n\n`;
    }
    if (w.exhibits) md += `## Links and Files\n${w.exhibits}\n\n`;
    return md;
}

// ── Learn / guides ────────────────────────────────────────────────────────────

window.openGuide = async (slug) => {
    state.activeGuide = slug;
    state.guideHtml = null;
    state.view = 'learn';
    window.location.hash = `#/learn/${slug}`;
    updateUI();

    // Try API first (editor-saved version), fall back to static file
    let markdown = null;
    try {
        const data = await fetchGuide(slug);
        markdown = data.content;
        state.guideLastEditor = data.updated_by_name || null;
        state.guideLastUpdated = data.updated_at || null;
    } catch {
        try {
            const res = await fetch(`docs/guides/${slug}.md`);
            if (res.ok) markdown = await res.text();
        } catch {}
        state.guideLastEditor = null;
        state.guideLastUpdated = null;
    }

    if (markdown && typeof marked !== 'undefined') {
        state.guideHtml = marked.parse(markdown);
        state.guideRawContent = markdown;
    } else if (markdown) {
        state.guideHtml = `<pre>${markdown}</pre>`;
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
    window.location.hash = '#/learn';
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
        <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-md p-8">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                        <i data-lucide="plus" class="w-5 h-5 text-blue-600"></i>
                    </div>
                    <h2 class="text-xl font-black text-slate-900 dark:text-white">New Guide</h2>
                </div>
                <button onclick="document.getElementById('new-guide-modal').remove()"
                        class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Title</label>
            <input id="ng-title" type="text" placeholder="Guide title" maxlength="120"
                oninput="window._ngSlugFromTitle()"
                class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-blue-400 mb-4 font-medium">

            <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Slug <span class="font-normal normal-case tracking-normal text-slate-400">— URL identifier</span></label>
            <input id="ng-slug" type="text" placeholder="my-guide-slug" maxlength="80"
                class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-blue-400 mb-4 font-mono text-sm">

            <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Section</label>
            <select id="ng-section" onchange="window._ngToggleNewSection()"
                class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-blue-400 mb-3 font-medium">
                ${sectionOptions}
                <option value="__new__">+ New section…</option>
            </select>
            <div id="ng-new-section-wrap" class="hidden mb-4">
                <input id="ng-new-section-label" type="text" placeholder="Section name (e.g. Getting Started)"
                    class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-blue-400 font-medium">
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
        window.location.hash = '#/learn';
        await loadGuides();
    } catch (e) {
        alert(e.message || 'Failed to delete guide.');
    }
};

// ── Theme ─────────────────────────────────────────────────────────────────────

window.toggleTheme = () => {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('cap_theme', isDark ? 'dark' : 'light');
};

// Apply saved theme on load
(function applyTheme() {
    const t = localStorage.getItem('cap_theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
    else if (t === 'light') document.documentElement.classList.remove('dark');
    else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
    }
})();

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
        <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-md p-8">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
                        <i data-lucide="bug" class="w-5 h-5 text-red-500"></i>
                    </div>
                    <h2 class="text-xl font-black text-slate-900 dark:text-white">Report a Bug</h2>
                </div>
                <button onclick="document.getElementById('bug-report-modal').remove()"
                        class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Title</label>
            <input id="bug-title" type="text" placeholder="Short summary of the issue" maxlength="120"
                class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-red-400 mb-4 font-medium">

            <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Description</label>
            <textarea id="bug-description" rows="4" placeholder="What happened? What did you expect? Steps to reproduce…"
                class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-red-400 mb-4 font-medium resize-none"></textarea>

            <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                Screenshot <span class="text-slate-400 font-normal normal-case tracking-normal">— optional</span>
            </label>
            <label class="flex flex-col items-center justify-center w-full h-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-red-300 cursor-pointer transition-colors mb-1" id="bug-screenshot-label">
                <i data-lucide="image-plus" class="w-6 h-6 text-slate-400 mb-1"></i>
                <span class="text-xs text-slate-400">Click to attach or paste an image</span>
                <input id="bug-screenshot-input" type="file" accept="image/*" class="hidden" onchange="window._bugScreenshotPicked(this)">
            </label>
            <div id="bug-screenshot-preview" class="hidden mb-4 relative">
                <img id="bug-screenshot-img" src="" class="w-full rounded-2xl border border-slate-200 dark:border-slate-700 max-h-40 object-contain">
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
    preview.innerHTML = typeof marked !== 'undefined'
        ? marked.parse(ta.value)
        : ta.value;
}

window.openGuideEditor = () => {
    const slug = state.activeGuide;
    const existing = document.getElementById('guide-editor-modal');
    if (existing) existing.remove();

    const defaultTitle = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const currentContent = state.guideRawContent || '';

    const toolbarHtml = _guideToolbar.map(btn => {
        if (btn.label === '|') return `<span class="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></span>`;
        return `<button type="button" title="${btn.title}" onclick="window._guideTbAction('${btn.title}')"
            class="px-2 py-1 rounded-lg text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 transition-colors shrink-0">${btn.label}</button>`;
    }).join('');

    const div = document.createElement('div');
    div.innerHTML = `
    <div id="guide-editor-modal"
         class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col" style="width:min(96vw,1100px);max-height:92vh">

            <!-- Header -->
            <div class="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
                        <i data-lucide="pencil" class="w-5 h-5 text-amber-600"></i>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-slate-900 dark:text-white">Edit Guide</h2>
                        <p class="text-xs text-slate-400 font-mono">${slug}</p>
                    </div>
                </div>
                <button onclick="document.getElementById('guide-editor-modal').remove()"
                        class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Title -->
            <div class="px-8 pb-3 shrink-0">
                <input id="guide-editor-title" type="text" value="${defaultTitle.replace(/"/g, '&quot;')}" maxlength="120"
                    placeholder="Guide title"
                    class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-amber-400 font-bold text-lg">
            </div>

            <!-- Toolbar -->
            <div class="px-8 pb-2 shrink-0">
                <div class="flex items-center flex-wrap gap-0.5 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    ${toolbarHtml}
                </div>
            </div>

            <!-- Split pane -->
            <div class="px-8 flex-1 overflow-hidden grid grid-cols-2 gap-4 min-h-0 pb-2">
                <div class="flex flex-col min-h-0">
                    <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Write</p>
                    <textarea id="guide-editor-content"
                        oninput="window._guideUpdatePreview()"
                        class="flex-1 w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-amber-400 resize-none"
                        placeholder="Start writing…">${currentContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="flex flex-col min-h-0">
                    <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Preview</p>
                    <div id="guide-editor-preview"
                        class="flex-1 overflow-y-auto px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 prose dark:prose-invert max-w-none text-sm">
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
                        class="px-6 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 font-black hover:border-slate-400 transition-colors">
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
