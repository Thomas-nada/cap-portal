import { shortAddress, formatUser } from '../wallet.js';

function stripFrontmatter(body) {
    if (!body) return '';
    return body.replace(/^---[\s\S]*?---\s*/m, '').trimStart();
}

function md(text) {
    return window.safeMarkdown(text);
}

function renderStructuredBody(s, type) {
 if (!s) return '<p class="text-slate-400">No content.</p>';
    const isCIS = type === 'CIS';
    const sections = [];

    if (s.abstract)    sections.push(`<h2>Summary</h2>${md(s.abstract)}`);
    if (isCIS) {
        if (s.motivation) sections.push(`<h2>Problem</h2>${md(s.motivation)}`);
        if (s.analysis)   sections.push(`<h2>Context</h2>${md(s.analysis)}`);
        if (s.impact)     sections.push(`<h2>Impact</h2>${md(s.impact)}`);
    } else {
        if (s.motivation) sections.push(`<h2>Why is this change needed?</h2>${md(s.motivation)}`);
        if (s.analysis)   sections.push(`<h2>Analysis &amp; Test</h2>${md(s.analysis)}`);
    }

    if (s.revisions?.length) {
        const revHtml = s.revisions.map((r, i) => r.type === 'addition' ? `
 <div class="rounded-2xl border border-cyan-100 overflow-hidden mb-4">
 ${r.section ? `<div class="px-5 py-2 bg-cyan-50 text-sm font-black text-cyan-500 uppercase tracking-widest">${r.section}</div>` : ''}
 <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-cyan-100 ">
 <div class="p-5">
 <div class="text-sm font-black uppercase tracking-widest text-cyan-500 mb-2">Insert After</div>
 <div class="text-sm text-slate-600 font-mono leading-relaxed italic">${escapeHtml(r.insert_after || '')}</div>
                    </div>
 <div class="p-5">
 <div class="text-sm font-black uppercase tracking-widest text-cyan-600 mb-2">New Text</div>
 <div class="text-sm text-slate-900 font-mono leading-relaxed">${escapeHtml(r.proposed || '')}</div>
                    </div>
                </div>
            </div>` : `
 <div class="rounded-2xl border border-slate-100 overflow-hidden mb-4">
 ${r.section ? `<div class="px-5 py-2 bg-slate-50 text-sm font-black text-slate-400 uppercase tracking-widest">${r.section}</div>` : ''}
 <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 ">
 <div class="p-5">
 <div class="text-sm font-black uppercase tracking-widest text-red-400 mb-2">Original</div>
 <div class="text-sm text-slate-600 font-mono leading-relaxed">${escapeHtml(r.original || '')}</div>
                    </div>
 <div class="p-5">
 <div class="text-sm font-black uppercase tracking-widest text-green-500 mb-2">Proposed</div>
 <div class="text-sm text-slate-900 font-mono leading-relaxed">${escapeHtml(r.proposed || '')}</div>
                    </div>
                </div>
            </div>`).join('');
        sections.push(`<h2>Proposed Revisions</h2>${revHtml}`);
    }

    if (s.exhibits)    sections.push(`<h2>Links &amp; Files</h2>${md(s.exhibits)}`);

    return sections.join('\n');
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const SUGGESTION_LABELS = {
    title: 'Title', abstract: 'Summary', motivation: 'Why is this change needed?',
    analysis: 'Analysis & Test', impact: 'Impact', exhibits: 'Links & Files',
};

const SUGGERABLE_FIELDS = ['title', 'abstract', 'motivation', 'analysis', 'impact', 'exhibits'];

function renderSuggestions(state, p, isAuthor, isEditor) {
    const suggestions = state.suggestions || [];
    const pending = suggestions.filter(s => s.status === 'pending');
    const resolved = suggestions.filter(s => s.status !== 'pending');

    if (!isEditor && !isAuthor && !suggestions.length) return '';

    const pendingCards = pending.map(s => `
 <div class="bg-white/80 rounded-2xl border-2 border-blue-100 p-6 space-y-4">
 <div class="flex items-start justify-between gap-4">
            <div>
 <span class="text-sm font-black uppercase tracking-widest text-blue-500">${escapeHtml(SUGGESTION_LABELS[s.field] || s.field)}</span>
 <p class="text-sm text-slate-500 mt-0.5">
 Suggested by <span class="font-bold text-slate-700 ">${escapeHtml(s.editor_display_name || shortAddress(s.editor_stake_address))}</span>
 <span class="text-slate-400 font-mono">(${shortAddress(s.editor_stake_address)})</span>
                </p>
            </div>
 <span class="flex-shrink-0 px-2.5 py-1 rounded-full text-sm font-black uppercase tracking-widest bg-amber-100 text-amber-700 ">Pending</span>
        </div>
        ${s.current_value ? `
        <div>
 <p class="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Current</p>
 <div class="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-slate-500 max-h-24 overflow-y-auto font-mono whitespace-pre-wrap line-through opacity-70">${escapeHtml(s.current_value)}</div>
        </div>` : ''}
        <div>
 <p class="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Suggested</p>
 <div class="bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-slate-700 max-h-24 overflow-y-auto font-mono whitespace-pre-wrap">${escapeHtml(s.suggested_value)}</div>
        </div>
 ${s.reason ? `<p class="text-sm text-slate-400 italic">"${escapeHtml(s.reason)}"</p>` : ''}
        ${isAuthor ? `
 <div class="flex gap-3 pt-2">
            <button onclick="window.approveSuggestion(${s.id})"
 class="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all">
 <i data-lucide="check" class="w-3.5 h-3.5"></i> Approve
            </button>
            <button onclick="window.rejectSuggestion(${s.id})"
 class="flex items-center gap-2 px-5 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 text-sm font-black uppercase tracking-widest rounded-xl transition-all">
 <i data-lucide="x" class="w-3.5 h-3.5"></i> Reject
            </button>
        </div>` : ''}
    </div>`).join('');

    const resolvedCards = resolved.map(s => `
 <div class="rounded-2xl border border-slate-100 p-5 opacity-60 space-y-2">
 <div class="flex items-center justify-between">
 <span class="text-sm font-black uppercase tracking-widest text-slate-400">${escapeHtml(SUGGESTION_LABELS[s.field] || s.field)}</span>
 <span class="px-2.5 py-1 rounded-full text-sm font-black uppercase tracking-widest ${s.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">${s.status}</span>
        </div>
 <p class="text-sm text-slate-400 font-mono whitespace-pre-wrap truncate">${escapeHtml(s.suggested_value)}</p>
    </div>`).join('');

    const suggestButtons = isEditor && !isAuthor ? `
 <div class="flex flex-wrap gap-2 pt-2">
        ${SUGGERABLE_FIELDS.map(f => `
        <button onclick="window.openSuggestModal('${f}')"
 class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 text-blue-600 text-sm font-black uppercase tracking-widest hover:bg-blue-50 transition-all">
 <i data-lucide="plus" class="w-3 h-3"></i> ${SUGGESTION_LABELS[f]}
        </button>`).join('')}
    </div>` : '';

    return `
 <section class="space-y-6 pt-16 border-t border-slate-100 ">
 <div class="flex items-center justify-between px-4">
 <h2 class="text-sm font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-2">
 <i data-lucide="git-pull-request" class="w-3.5 h-3.5"></i> Suggested Changes
            </h2>
 ${pending.length ? `<span class="text-sm font-black text-amber-600 uppercase tracking-widest">${pending.length} pending</span>` : ''}
        </div>
        ${suggestButtons}
 ${pending.length ? `<div class="space-y-4">${pendingCards}</div>` : (isEditor && !isAuthor ? `<p class="text-sm text-slate-400 px-4">No pending suggestions.</p>` : '')}
        ${resolved.length ? `
 <details class="px-1">
 <summary class="text-sm font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">Show ${resolved.length} resolved</summary>
 <div class="mt-3 space-y-2">${resolvedCards}</div>
        </details>` : ''}
    </section>`;
}

export function renderDetail(state) {
    const p = state.currentProposal;
    if (!p || state.loading?.detail) {
        return `
 <div class="flex items-center justify-center py-40">
 <div class="flex flex-col items-center gap-6">
 <div class="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
 <p class="text-slate-400 font-bold uppercase tracking-widest text-sm">Loading proposal...</p>
                </div>
            </div>`;
    }

    const myStake = state.user?.stake_address;
    const isAuthor = myStake && myStake === p.author_stake_address;
    const isEditor = state.user?.is_editor === true;
    const isAdmin = state.user?.is_admin === true;

    const authorName = p.author_display_name || shortAddress(p.author_stake_address);
    const authorAddr = shortAddress(p.author_stake_address);
    const createdDate = new Date(p.created_at);
    const expiryDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    window.toggleEventExpansion = (id) => {
        state.expandedEventId = state.expandedEventId == id ? null : id;
        window.updateUI?.(true);
    };
    window.toggleAuditTrail = () => {
        state.auditTrailExpanded = !state.auditTrailExpanded;
        window.updateUI?.(true);
    };
    window.toggleAuditPanel = () => {
        state.auditPanelExpanded = !state.auditPanelExpanded;
        window.updateUI?.(true);
    };
    window.toggleVersionHistory = () => {
        state.versionHistoryExpanded = !state.versionHistoryExpanded;
        window.updateUI?.(true);
    };
    window.toggleAuthorControls = () => {
        state.authorControlsExpanded = !state.authorControlsExpanded;
        window.updateUI?.(true);
    };
    window.toggleEditorControls = () => {
        state.editorControlsExpanded = !state.editorControlsExpanded;
        window.updateUI?.(true);
    };
    if (window.detailTimerInterval) clearInterval(window.detailTimerInterval);

    const LIFECYCLE = ['consultation', 'ready', 'done', 'withdrawn'];
    const nonLifecycle = (p.labels || []).filter(l => !LIFECYCLE.includes(l.name.toLowerCase()));

    return `
 <div class="max-w-7xl mx-auto pb-20 fade-in text-left">
 <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12">
 <button onclick="window.setView('list')" class="group flex items-center gap-2 text-on-surface-variant hover:text-brand-primary transition-colors font-bold uppercase text-sm tracking-widest">
 <i data-lucide="arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition-transform"></i>
                    Back to Registry
                </button>
 <span class="text-sm font-black text-on-surface-variant uppercase tracking-widest">#${p.number}</span>
            </div>

            <!-- Full-width header: tags, title, meta -->
 <header class="space-y-8 mb-16">
 <div class="flex flex-wrap gap-3">
 <span class="px-5 py-2 rounded-full text-sm font-black uppercase tracking-widest bg-white/15 text-on-surface border border-white/20">${p.type}</span>
                    ${(p.labels || []).filter(l => l.name !== p.type).map(l => `
 <span class="px-5 py-2 rounded-full text-sm font-black uppercase tracking-widest bg-white/15 text-on-surface border border-white/20">
                            ${escapeHtml(l.name)}
                        </span>
                    `).join('')}
                    ${p.state === 'closed' ? `
 <span class="px-5 py-2 rounded-full text-sm font-black uppercase tracking-widest bg-on-surface text-surface ">Closed</span>
                    ` : ''}
                </div>

 <h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-on-surface leading-[1.1]">
                    ${escapeHtml(p.title)}
                </h1>

 <div class="flex flex-wrap items-center gap-8 text-on-surface-variant font-medium border-b border-white/15 pb-10">
 <div class="flex items-center gap-3">
 <div class="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
 <i data-lucide="user" class="w-4 h-4 text-on-surface"></i>
                        </div>
 <div class="flex flex-col">
 <span class="text-sm font-black uppercase text-on-surface-variant tracking-widest leading-none mb-1">Author</span>
 <span class="text-sm font-bold text-on-surface ">${escapeHtml(authorName)}</span>
 <span class="text-sm text-on-surface-variant font-mono">(${authorAddr})</span>
                        </div>
                    </div>
 <div class="w-px h-8 bg-white/15 "></div>
 <div class="flex flex-col">
 <span class="text-sm font-black uppercase text-on-surface-variant tracking-widest leading-none mb-1">Submitted</span>
 <span class="text-sm font-bold text-on-surface ">${createdDate.toLocaleDateString()}</span>
                    </div>
 <div class="w-px h-8 bg-white/15 "></div>
 <div class="flex flex-col">
 <span class="text-sm font-black uppercase text-on-surface-variant tracking-widest leading-none mb-1">Recommended review period ends</span>
 <span class="text-sm font-bold text-on-surface ">${expiryDate.toLocaleDateString()}</span>
                    </div>
                </div>
            </header>

 <div class="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
                <!-- Main Body -->
 <div class="lg:col-span-2 space-y-16">
                    <!-- Proposal Body -->
 <article class="bg-white/80 p-10 sm:p-20 rounded-[4rem] border border-slate-100 shadow-sm prose max-w-none text-left leading-relaxed">
                        ${p.structured ? renderStructuredBody(p.structured, p.type) : window.safeMarkdown(stripFrontmatter(p.body) || '*No content.*')}
                    </article>

                    ${(p.structured?.revisions?.length && p.structured.revisions.some(r => (r.original && r.proposed) || (r.insert_after && r.proposed))) ? `
 <div class="bg-blue-50/60 border border-blue-100 rounded-[3rem] p-8 flex items-center justify-between gap-6">
 <div class="flex items-center gap-4">
 <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
 <i data-lucide="git-diff" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
 <p class="text-sm font-black text-slate-900 ">Proposed Constitution Draft</p>
 <p class="text-sm text-slate-500 mt-0.5">${p.structured.revisions.filter(r => (r.original && r.proposed) || (r.insert_after && r.proposed)).length} change${p.structured.revisions.filter(r => (r.original && r.proposed) || (r.insert_after && r.proposed)).length !== 1 ? 's' : ''} — view side-by-side diff against current</p>
                            </div>
                        </div>
                        <button onclick="window.viewProposalDiff(${p.number})"
 class="flex-shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl text-sm font-black transition-all hover:-translate-y-0.5 shadow-lg">
 <i data-lucide="columns-2" class="w-4 h-4"></i>
                            View Diff
                        </button>
                    </div>
                    ` : ''}

                    <!-- Suggestions -->
                    ${renderSuggestions(state, p, isAuthor, isEditor)}

                    <!-- Comments -->
 <section class="space-y-12 pt-16 border-t border-slate-100 ">
 <div class="flex items-center justify-between px-4">
 <h2 class="text-sm font-black uppercase tracking-[0.4em] text-slate-400">Discussion</h2>
 <span class="text-sm font-black text-blue-600 uppercase tracking-widest">${(state.comments||[]).length} ${(state.comments||[]).length === 1 ? 'Comment' : 'Comments'}</span>
                        </div>

 <div class="space-y-8">
                            ${(state.comments||[]).length === 0 ? `
 <div class="p-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
 <p class="text-slate-400 font-bold uppercase tracking-widest text-sm">No comments yet.</p>
                                </div>
                            ` : (state.comments||[]).map(c => {
                                const cName = c.author_display_name || shortAddress(c.author_stake_address);
                                const cAddr = shortAddress(c.author_stake_address);
                                const mod = c.moderation_status || 'visible';
                                const modBadge = mod === 'under_review'
                                    ? `<span class="text-sm font-black px-2 py-1 rounded-full bg-amber-500 text-white uppercase tracking-wider flex items-center gap-1"><i data-lucide="eye-off" class="w-2.5 h-2.5"></i> Under review</span>`
                                    : mod === 'removed'
                                    ? `<span class="text-sm font-black px-2 py-1 rounded-full bg-red-600 text-white uppercase tracking-wider flex items-center gap-1"><i data-lucide="ban" class="w-2.5 h-2.5"></i> Removed</span>`
                                    : '';
                                const cardBorder = mod === 'removed' ? 'border-red-200' : mod === 'under_review' ? 'border-amber-200' : 'border-slate-100';
                                const canFlag = (isEditor || isAdmin) && mod === 'visible';
                                return `
 <div class="flex gap-8 group ${mod !== 'visible' ? 'opacity-80' : ''}">
 <div class="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center flex-shrink-0">
 <i data-lucide="user" class="w-6 h-6 text-slate-400"></i>
                                    </div>
 <div class="flex-grow space-y-4">
 <div class="flex items-center gap-4 flex-wrap">
 <div class="flex flex-col leading-tight">
 <span class="text-sm font-black text-slate-900 ">${escapeHtml(cName)}</span>
 <span class="text-sm text-slate-400 font-mono">(${cAddr})</span>
                                            </div>
 <span class="text-sm font-bold text-slate-400 uppercase tracking-tighter">${new Date(c.created_at).toLocaleString()}</span>
                                            ${modBadge}
 <div class="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                ${canFlag ? `
                                                <button onclick="window.flagCommentForRemoval(${c.id})" title="Flag this comment for removal"
 class="text-slate-300 hover:text-red-500 transition-all p-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1 text-sm font-black uppercase tracking-wide">
 <i data-lucide="flag" class="w-3.5 h-3.5"></i> Flag
                                                </button>
                                                ` : ''}
                                            </div>
                                        </div>
 <div class="bg-white/80 p-8 rounded-[2.5rem] border ${cardBorder} shadow-sm text-sm leading-relaxed prose max-w-none">
                                            ${window.safeMarkdown(c.body)}
                                        </div>
                                    </div>
                                </div>`;
                            }).join('')}

                            ${state.user ? `
 <div class="pt-8 pl-0 sm:pl-20">
 <form onsubmit="event.preventDefault(); window.postComment(this)" class="space-y-6">
                                    <textarea name="comment" required placeholder="Share your thoughts…"
 class="w-full bg-white/80 p-10 rounded-[3rem] min-h-[200px] font-medium text-lg outline-none border-2 border-slate-100 focus:border-blue-600 transition-all text-slate-900 shadow-sm resize-none"></textarea>
 <div class="flex justify-end">
                                        <button type="submit" ${state.loading?.postComment ? 'disabled' : ''}
 class="bg-slate-950 text-white px-14 py-6 rounded-3xl font-black uppercase text-sm tracking-[0.3em] hover:-translate-y-1 active:scale-95 transition-all shadow-2xl disabled:opacity-50">
                                            ${state.loading?.postComment ? 'Posting…' : 'Post Comment'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                            ` : ''}
                        </div>
                    </section>

                </div>

                <!-- Sidebar -->
 <aside class="space-y-8 sticky top-28">
                    ${!state.user ? `
 <div class="bg-white/80 p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
 <p class="text-sm text-slate-500 font-bold mb-3">Have a wallet? Connect to comment.</p>
                        <button onclick="window.loginWithWallet()"
 class="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-slate-950 text-white rounded-xl text-sm font-black hover:opacity-90 transition-all">
 <i data-lucide="wallet" class="w-3.5 h-3.5"></i> Connect Wallet
                        </button>
                    </div>
                    ` : ''}

                    <!-- Version History -->
                    ${renderVersionHistory(state, p)}

                    <!-- Audit Trail -->
 <div class="bg-white/80 p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
 <button onclick="window.toggleAuditPanel()" class="w-full flex items-center justify-between">
 <h3 class="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Audit Trail</h3>
 <div class="flex items-center gap-2">
 <span class="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse block"></span>
 <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${state.auditPanelExpanded ? 'rotate-180' : ''}"></i>
                            </div>
                        </button>
 ${state.auditPanelExpanded ? `<div class="mt-8">${renderAuditTrail(state)}</div>` : ''}
                    </div>

                    <!-- Author Controls -->
                    ${isAuthor ? renderAuthorControls(p, state) : ''}

                    <!-- Editor Controls -->
                    ${isEditor ? renderEditorControls(p, state) : ''}

                    <!-- Moderation (flag for removal; admins get a queue link) -->
                    ${(isEditor || isAdmin) ? renderModerationPanel(p, state, isAdmin) : ''}
                </aside>
            </div>
        </div>`;
}

function renderVersionHistory(state, p) {
    const versions = state.proposalVersions || [];
    if (!versions.length) return '';

    const expanded = state.versionHistoryExpanded;
    return `
 <div class="bg-white/80 p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
 <button onclick="window.toggleVersionHistory()" class="w-full flex items-center justify-between">
 <h3 class="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Version History</h3>
 <div class="flex items-center gap-2">
 <span class="text-sm font-black text-blue-600 uppercase tracking-widest">${versions.length} version${versions.length !== 1 ? 's' : ''}</span>
 <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}"></i>
            </div>
        </button>
 ${expanded ? `<div class="space-y-2 mt-6">
            ${versions.map((v, i) => {
                const isCurrent = i === 0;
                const when = new Date(v.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
                return `
                <button onclick="window.openVersionModal(${p.number}, ${v.version})"
 class="w-full text-left flex items-center gap-4 px-4 py-3 rounded-2xl transition-all
                        ${isCurrent ? 'bg-blue-50 border border-blue-100 ' : 'hover:bg-slate-50 border border-transparent'}">
 <span class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black
                        ${isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 '}">
                        V${v.version}
                    </span>
 <div class="min-w-0 flex-1">
 <p class="text-sm font-bold text-slate-900 truncate">${escapeHtml(v.change_summary || 'Update')}</p>
 <p class="text-sm text-slate-400 mt-0.5">${when} · ${escapeHtml(v.created_by_name || shortAddress(v.created_by))}</p>
 ${v.content_hash ? `<p class="text-sm text-slate-300 font-mono mt-1 truncate" title="${v.content_hash}">${v.content_hash.slice(0, 16)}…</p>` : ''}
                    </div>
 ${isCurrent ? `<span class="flex-shrink-0 text-sm font-black uppercase tracking-widest text-blue-500">Current</span>` : `<i data-lucide="eye" class="w-3.5 h-3.5 text-slate-300 flex-shrink-0"></i>`}
                </button>`;
            }).join('')}
        </div>` : ''}
    </div>`;
}

function renderAuditTrail(state) {
    const events = state.auditEvents || [];
    const LIMIT = 5;
    const isExpanded = state.auditTrailExpanded;
    const visible = isExpanded ? events : events.slice(0, LIMIT);
    const hasMore = events.length > LIMIT;

    if (events.length === 0) {
 return `<p class="text-sm text-slate-400 italic">No audit events yet.</p>`;
    }

    return `
 <div class="space-y-5 relative">
 <div class="absolute left-[13px] top-2 bottom-2 w-[2px] bg-slate-100 "></div>
        ${visible.map(ev => {
            const name = ev.actor_display_name || shortAddress(ev.actor_stake_address) || 'Unknown';
            const addr = shortAddress(ev.actor_stake_address);
            const details = getAuditDetails(ev, state);
            const isEvExpanded = state.expandedEventId == ev.id;
            const when = new Date(ev.created_at);
            const whenStr = when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                + ' · ' + when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            return `
 <div class="flex gap-4 relative z-10">
 <div class="w-7 h-7 rounded-lg bg-slate-100 border-2 border-white flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer transition-transform hover:scale-110"
                     onclick="window.toggleEventExpansion('${ev.id}')">
 <i data-lucide="${details.icon}" class="w-3.5 h-3.5 ${details.color}"></i>
                </div>
 <div class="flex-grow min-w-0">
 <div class="flex items-start justify-between gap-2 mb-1.5 cursor-pointer" onclick="window.toggleEventExpansion('${ev.id}')">
 <div class="min-w-0">
 <p class="text-sm font-black text-slate-900 leading-tight">${escapeHtml(details.message)}</p>
 <p class="text-sm text-slate-400 mt-0.5">
 ${escapeHtml(name)}${ev.actor_display_name ? ` <span class="font-mono">(${addr})</span>` : ''}
                            </p>
                        </div>
 <span class="text-sm text-slate-400 font-bold whitespace-nowrap flex-shrink-0">${whenStr}</span>
                    </div>
                    ${details.detail ? `
 <div class="cursor-pointer" onclick="window.toggleEventExpansion('${ev.id}')">
                        ${isEvExpanded ? `
 <div class="mt-1 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-500 leading-relaxed whitespace-pre-wrap font-mono">
                            ${escapeHtml(details.detail)}
                        </div>` : `
 <p class="text-sm text-slate-400 italic truncate">
 <i data-lucide="chevron-right" class="w-2.5 h-2.5 inline-block mr-0.5 align-middle"></i>click to expand
                        </p>`}
                    </div>` : ''}
                </div>
            </div>`;
        }).join('')}
    </div>
    ${hasMore ? `
    <button onclick="window.toggleAuditTrail()"
 class="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-200 text-sm font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all">
 <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
        ${isExpanded ? 'Show less' : `Show all ${events.length} events`}
    </button>` : ''}`;
}

function renderAuthorControls(p, state) {
    const labels = (p.labels || []).map(l => l.name);
    const stage = ['consultation','ready','done','withdrawn'].find(s => labels.includes(s)) || null;
    const authorReady = labels.includes('author-ready');
    const isActive = !stage || stage === 'consultation';
    const isLocked = stage === 'ready' || stage === 'done' || stage === 'withdrawn';
    const isRevision = labels.includes('revision');

    const signalText = stage === 'consultation' ? 'Signal Ready for Review'
                     : stage === 'ready' ? 'Signal Ready for Completion'
                     : null;

    const expanded = state.authorControlsExpanded;
    return `
 <div class="bg-white/80 p-8 rounded-[2.5rem] border-2 border-blue-100 shadow-xl">
 <button onclick="window.toggleAuthorControls()" class="w-full flex items-center justify-between">
 <h3 class="text-sm font-black uppercase tracking-[0.2em] text-blue-600">Author Controls</h3>
 <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-blue-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}"></i>
        </button>

 ${expanded ? `<div class="space-y-6 mt-6">
        ${isRevision ? `
 <div class="flex items-start gap-3 px-4 py-3 rounded-2xl bg-orange-50 border border-orange-200 ">
 <i data-lucide="pencil-line" class="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5"></i>
            <div>
 <span class="text-sm font-black uppercase tracking-wider text-orange-700 block">Revision Active</span>
 <span class="text-sm text-orange-500 leading-relaxed">An editor has flagged this proposal for revision.</span>
            </div>
        </div>` : ''}

 <div class="space-y-3">
            ${signalText ? `
            <button onclick="window.authorSignalReady()"
 class="w-full flex items-center justify-between p-5 rounded-2xl transition-all group border ${
                    authorReady ? 'bg-green-600 border-green-600' : 'bg-green-50 border-green-100 hover:bg-green-100 '
                }">
 <div class="flex items-center gap-3">
 <i data-lucide="${authorReady ? 'check-circle' : 'thumbs-up'}" class="w-4 h-4 ${authorReady ? 'text-white' : 'text-green-600'}"></i>
 <span class="text-sm font-bold ${authorReady ? 'text-white' : 'text-green-700 '}">
                        ${authorReady ? '✓ Ready Signal Active' : signalText}
                    </span>
                </div>
 <i data-lucide="chevron-right" class="w-4 h-4 ${authorReady ? 'text-green-200' : 'text-green-300'} group-hover:translate-x-1 transition-transform"></i>
            </button>
            ` : ''}

            ${isActive ? `
 <button onclick="window.startEdit()" class="w-full flex items-center justify-between p-5 rounded-2xl bg-blue-50 hover:bg-blue-100 transition-all group">
 <div class="flex items-center gap-3">
 <i data-lucide="edit-3" class="w-4 h-4 text-blue-600"></i>
 <span class="text-sm font-bold text-blue-600">Edit Proposal</span>
                </div>
 <i data-lucide="chevron-right" class="w-4 h-4 text-blue-300 group-hover:translate-x-1 transition-transform"></i>
            </button>
            ` : ''}
            ${isLocked ? `
 <div class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 ">
 <i data-lucide="lock" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0"></i>
 <span class="text-sm font-bold text-slate-500 uppercase tracking-wider">Editing locked — proposal has passed consultation</span>
            </div>
            ` : ''}

            ${stage !== 'withdrawn' ? `
 <button onclick="window.authorWithdraw()" class="w-full flex items-center justify-between p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all group border border-slate-100 ">
 <div class="flex items-center gap-3">
 <i data-lucide="x-circle" class="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors"></i>
                    <div>
 <span class="text-sm font-bold text-slate-600 block">Withdraw Proposal</span>
 <span class="text-sm text-slate-400">Closes and marks as withdrawn</span>
                    </div>
                </div>
 <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300"></i>
            </button>` : ''}
        </div>

 <p class="text-sm text-slate-400 leading-relaxed">
            Editors control lifecycle stage progression. Your ready signal is advisory. All actions are permanently recorded.
        </p>
        </div>` : ''}
    </div>`;
}

function renderEditorControls(p, state) {
    const labels = (p.labels || []).map(l => l.name);
    const LIFECYCLE = ['consultation','ready','done','withdrawn'];
    const currentStage = LIFECYCLE.find(s => labels.includes(s)) || null;
    const authorReady = labels.includes('author-ready');

    const nextStage = currentStage === null ? 'consultation'
                    : currentStage === 'consultation' ? 'ready'
                    : currentStage === 'ready' ? 'done'
                    : null;

    const STAGE_CFG = {
        consultation: { color: 'purple',  icon: 'message-circle', label: 'Consultation' },
        ready:        { color: 'green',   icon: 'check-circle',    label: 'Ready' },
        done:         { color: 'emerald', icon: 'award',           label: 'Done' },
        withdrawn:    { color: 'red',    icon: 'x-circle',        label: 'Withdrawn' },
    };

    const STATUS_TAGS = ['review','revision','finalizing','onchain'];
    const SIGNAL_TAGS = {
        'editor-ok':       { color: 'green',  icon: 'check-circle', label: 'OK' },
        'editor-concern':  { color: 'red',    icon: 'alert-circle',  label: 'Concern' },
    };
    const currentSignal = Object.keys(SIGNAL_TAGS).find(s => labels.includes(s)) || null;
    const curCfg  = currentStage ? STAGE_CFG[currentStage] : null;
    const nextCfg = nextStage ? STAGE_CFG[nextStage] : null;

    const expanded = state.editorControlsExpanded;
    return `
 <div class="bg-white/80 p-8 rounded-[2.5rem] border-2 border-amber-100 shadow-xl">
 <button onclick="window.toggleEditorControls()" class="w-full flex items-center justify-between">
 <h3 class="text-sm font-black uppercase tracking-[0.2em] text-amber-600 flex items-center gap-2">
 <i data-lucide="shield" class="w-3.5 h-3.5"></i> Editor Controls
            </h3>
 <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-amber-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}"></i>
        </button>

 ${expanded ? `<div class="space-y-8 mt-8">
        <!-- Lifecycle -->
 <div class="space-y-3">
 <p class="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Lifecycle Stage</p>
            ${curCfg ? `
 <div class="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-${curCfg.color}-50 ${curCfg.color}-900/10 border border-${curCfg.color}-200 ${curCfg.color}-900/30 text-sm font-bold text-${curCfg.color}-700 ${curCfg.color}-300 uppercase tracking-wider">
 <i data-lucide="${curCfg.icon}" class="w-3.5 h-3.5 flex-shrink-0"></i>
                ${curCfg.label}
            </div>` : ''}
            ${nextCfg ? `
            ${authorReady ? `
 <div class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-sm font-bold text-green-700 ">
 <i data-lucide="thumbs-up" class="w-3.5 h-3.5 flex-shrink-0"></i>
                Author has signalled ready
            </div>` : ''}
            <button onclick="window.editorSetLifecycle('${nextStage}')"
 class="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border bg-${nextCfg.color}-50 ${nextCfg.color}-900/10 border-${nextCfg.color}-200 ${nextCfg.color}-900/30 hover:bg-${nextCfg.color}-100 ${nextCfg.color}-900/20 transition-all group">
 <div class="flex items-center gap-3">
 <i data-lucide="arrow-right-circle" class="w-4 h-4 text-${nextCfg.color}-600 flex-shrink-0"></i>
                    <div>
 <span class="text-sm font-bold text-${nextCfg.color}-700 ${nextCfg.color}-300 uppercase tracking-wider block">Move to ${nextCfg.label}</span>
 <span class="text-sm text-${nextCfg.color}-500">Permanently recorded</span>
                    </div>
                </div>
 <i data-lucide="chevron-right" class="w-4 h-4 text-${nextCfg.color}-300 group-hover:translate-x-1 transition-transform"></i>
            </button>
 ` : `<p class="text-sm text-slate-400 italic">No further transitions from this stage.</p>`}
        </div>

        <!-- Status Tags -->
 <div class="space-y-3">
 <p class="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Status Tags</p>
 <div class="flex flex-wrap gap-2">
                ${STATUS_TAGS.map(tag => {
                    const active = labels.includes(tag);
                    return `<button onclick="window.editorToggleStatusTag('${tag}')"
 class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all ${
                            active ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-400'
                        }">
                        ${tag}
                    </button>`;
                }).join('')}
            </div>
        </div>

        <!-- Editor Signal -->
 <div class="space-y-3">
 <p class="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Editor Signal</p>
 <div class="flex flex-col gap-2">
                ${Object.entries(SIGNAL_TAGS).map(([tag, cfg]) => {
                    const active = currentSignal === tag;
                    return `<button onclick="window.editorToggleSignal('${tag}')"
 class="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all ${
                            active ? `bg-${cfg.color}-600 text-white border-${cfg.color}-600` : `bg-slate-50 text-slate-600 border-slate-200 hover:border-${cfg.color}-400`
                        }">
 <i data-lucide="${cfg.icon}" class="w-3.5 h-3.5 flex-shrink-0"></i>
                        ${cfg.label}
                    </button>`;
                }).join('')}
            </div>
        </div>

        <!-- Withdraw override (two-person rule for editors) -->
        ${renderEditorWithdraw(p, state, labels)}
        </div>` : ''}
    </div>`;
}

function renderModerationPanel(p, state, isAdmin) {
    const mod = p.moderation_status || 'visible';
    let statusBlock = '';
    if (mod === 'under_review') {
        statusBlock = `
 <div class="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500 text-white text-sm font-black uppercase tracking-wider mb-4">
 <i data-lucide="eye-off" class="w-3.5 h-3.5 flex-shrink-0"></i> Hidden — under review by an admin
        </div>`;
    } else if (mod === 'removed') {
        statusBlock = `
 <div class="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-black uppercase tracking-wider mb-4">
 <i data-lucide="ban" class="w-3.5 h-3.5 flex-shrink-0"></i> Removed — visible to admins only
        </div>`;
    }

    const flagBtn = mod === 'visible' ? `
        <button onclick="window.flagProposalForRemoval()"
 class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-black uppercase tracking-wider hover:bg-red-100 transition-all">
 <i data-lucide="flag" class="w-3.5 h-3.5"></i> Flag for Removal
        </button>` : '';

    const queueBtn = (isAdmin && mod !== 'visible') ? `
        <button onclick="window.setView('moderation')"
 class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm font-black uppercase tracking-wider hover:bg-slate-100 transition-all mt-2">
 <i data-lucide="gavel" class="w-3.5 h-3.5"></i> Review in Moderation Queue
        </button>` : '';

    return `
 <div class="bg-white/80 p-8 rounded-[2.5rem] border-2 border-red-100 shadow-xl">
 <h3 class="text-sm font-black uppercase tracking-[0.2em] text-red-600 flex items-center gap-2 mb-4">
 <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i> Moderation
        </h3>
        ${statusBlock}
 <p class="text-sm text-slate-400 mb-4">Flagging hides the content and sends it to an admin with your reason. The author is notified it is under review.</p>
        ${flagBtn}
        ${queueBtn}
    </div>`;
}

function renderEditorWithdraw(p, state, labels) {
    if (labels.includes('withdrawn')) return '';

    const myStake = state.user?.stake_address;
    const isAuthor = myStake && myStake === p.author_stake_address;
    // The author withdraws via their own panel (direct, no second editor needed).
    if (isAuthor) return '';

    const pendingBy = p.withdrawal_requested_by;
    const pendingByName = p.withdrawal_requested_by_name;
    const pendingByMe = pendingBy && pendingBy === myStake;

    const cancelBtn = `
        <button onclick="window.editorCancelWithdraw()"
 class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-500 text-sm font-black uppercase tracking-wider hover:bg-slate-50 transition-all">
 <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            Cancel withdrawal request
        </button>`;

    let inner;
    if (!pendingBy) {
        // No request yet — this editor opens one.
        inner = `
            <button onclick="window.editorWithdraw()"
 class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm font-black uppercase tracking-wider hover:bg-red-100 transition-all">
 <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                Request Withdrawal
            </button>
 <p class="text-sm text-slate-400 text-center mt-2">A second, different editor must confirm before this takes effect.</p>`;
    } else if (pendingByMe) {
        // This editor already requested — they cannot self-confirm.
        inner = `
 <div class="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm font-bold text-amber-700 mb-2">
 <i data-lucide="clock" class="w-3.5 h-3.5 flex-shrink-0 mt-px"></i>
                <span>You requested withdrawal. Awaiting confirmation from another editor — you cannot confirm your own request.</span>
            </div>
            ${cancelBtn}`;
    } else {
        // A different editor requested — this editor can confirm.
        const who = escapeHtml(pendingByName || shortAddress(pendingBy));
        inner = `
 <div class="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm font-bold text-amber-700 mb-2">
 <i data-lucide="clock" class="w-3.5 h-3.5 flex-shrink-0 mt-px"></i>
                <span>Withdrawal requested by ${who}. Confirm to finalise.</span>
            </div>
            <button onclick="window.editorWithdraw()"
 class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-600 border border-red-600 text-white text-sm font-black uppercase tracking-wider hover:bg-red-700 transition-all mb-2">
 <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                Confirm Withdrawal
            </button>
            ${cancelBtn}`;
    }

    return `
 <div class="pt-4 border-t border-slate-100 ">
 <p class="text-sm font-black uppercase tracking-[0.18em] text-slate-400 mb-3">Withdraw Proposal</p>
            ${inner}
        </div>`;
}

const FIELD_LABELS = {
    title: 'Title', abstract: 'Summary', motivation: 'Why is this change needed?',
    analysis: 'Analysis & Test', impact: 'Impact', exhibits: 'Links & Files',
};

const LABEL_DESCRIPTIONS = {
    consultation: 'Proposal is open for community discussion',
    ready: 'Author has signalled the proposal is ready for editor review',
    done: 'Proposal has been finalised and closed',
    withdrawn: 'Proposal has been withdrawn',
    'author-ready': 'Author marked proposal as ready for review',
    review: 'Editor has taken the proposal into review',
    revision: 'Editor has requested revisions from the author',
    finalizing: 'Proposal is in the finalizing stage',
    onchain: 'Proposal has been submitted on-chain',
    'editor-ok': 'Editor has signalled approval',
    'editor-concern': 'Editor has raised a concern',
    'editor-suggested': 'Editor has made a suggestion',
    major: 'Classified as a major change',
    minor: 'Classified as a minor change',
    bundle: 'Flagged for bundling with other proposals',
    'fast-track': 'Flagged for fast-track consideration',
    pause: 'Proposal has been paused',
    'flagged-for-removal': 'Editor has flagged this proposal for admin review (possible spam or abuse)',
    CAP: 'Type: Constitutional Amendment Proposal',
    CIS: 'Type: Constitutional Interpretation Statement',
};

function getAuditDetails(ev, state) {
    let data = {};
    if (ev.data && typeof ev.data === 'object') data = ev.data;
    else if (ev.data) try { data = JSON.parse(ev.data); } catch {}

    const fieldLabel = data.field ? (FIELD_LABELS[data.field] || data.field) : null;

    switch (ev.event_type) {
        case 'proposal_created':
            return {
                icon: 'plus-circle', color: 'text-blue-600',
                message: 'Proposal submitted',
                detail: data.type ? `Type: ${data.type}` : '',
            };

        case 'proposal_edited': {
            const changes = [];
            if (data.title) changes.push(`Title: "${data.title.from}" → "${data.title.to}"`);
            if (data.body_updated) changes.push('Content updated');
            return {
                icon: 'pencil', color: 'text-blue-500',
                message: 'Proposal edited',
                detail: changes.join('\n') || '',
            };
        }

        case 'label_added': {
            const lbl = data.label || '';
            const desc = LABEL_DESCRIPTIONS[lbl] || '';
            return {
                icon: 'tag', color: 'text-purple-500',
                message: `Label added — ${lbl}`,
                detail: desc,
            };
        }

        case 'label_removed': {
            const lbl = data.label || '';
            return {
                icon: 'tag', color: 'text-slate-400',
                message: `Label removed — ${lbl}`,
                detail: LABEL_DESCRIPTIONS[lbl] || '',
            };
        }

        case 'comment_added': {
            const comment = (state?.comments || []).find(c =>
                c.author_stake_address === ev.actor_stake_address &&
                Math.abs(new Date(c.created_at) - new Date(ev.created_at)) < 5000
            );
            return {
                icon: 'message-circle', color: 'text-slate-500',
                message: 'Comment posted',
                detail: comment ? comment.body.slice(0, 200) + (comment.body.length > 200 ? '…' : '') : '',
            };
        }

        case 'suggestion_created': {
            const suggestion = (state?.suggestions || []).find(s =>
                s.editor_stake_address === ev.actor_stake_address && s.field === data.field
            );
            return {
                icon: 'git-pull-request', color: 'text-blue-500',
                message: `Suggested change — ${fieldLabel || data.field || ''}`,
                detail: suggestion
                    ? (suggestion.reason ? `Reason: ${suggestion.reason}\n\n` : '') +
                      `Suggested: ${suggestion.suggested_value.slice(0, 300)}${suggestion.suggested_value.length > 300 ? '…' : ''}`
                    : fieldLabel || '',
            };
        }

        case 'suggestion_approved': {
            const suggestion = (state?.suggestions || []).find(s => s.id === data.suggestion_id);
            return {
                icon: 'check-circle', color: 'text-green-600',
                message: `Suggestion approved — ${fieldLabel || data.field || ''}`,
                detail: suggestion
                    ? `Applied: ${suggestion.suggested_value.slice(0, 300)}${suggestion.suggested_value.length > 300 ? '…' : ''}`
                    : '',
            };
        }

        case 'suggestion_rejected':
            return {
                icon: 'x-circle', color: 'text-red-400',
                message: `Suggestion rejected — ${fieldLabel || data.field || ''}`,
                detail: '',
            };

        case 'withdrawn': {
            const detail = data.by === 'author'
                ? 'Withdrawn by the author'
                : data.requested_by_name
                    ? `Confirmed by a second editor (requested by ${data.requested_by_name})`
                    : 'Confirmed by a second editor';
            return {
                icon: 'x-circle', color: 'text-red-500',
                message: 'Proposal withdrawn',
                detail,
            };
        }

        case 'withdrawal_requested':
            return {
                icon: 'clock', color: 'text-amber-500',
                message: 'Withdrawal requested',
                detail: 'Awaiting confirmation from a second editor.',
            };

        case 'withdrawal_cancelled':
            return {
                icon: 'rotate-ccw', color: 'text-slate-400',
                message: 'Withdrawal request cancelled',
                detail: '',
            };

        case 'comment_edited':
            return {
                icon: 'pencil', color: 'text-slate-500',
                message: 'Comment edited',
                detail: '',
            };

        case 'flagged_for_removal':
            return {
                icon: 'flag', color: 'text-amber-600',
                message: `${ev.data?.target === 'comment' ? 'Comment' : 'Proposal'} flagged for removal`,
                detail: ev.data?.reason ? `Reason: ${ev.data.reason}` : '',
            };

        case 'moderation_removed':
            return {
                icon: 'ban', color: 'text-red-600',
                message: `${ev.data?.target === 'comment' ? 'Comment' : 'Proposal'} removed by admin`,
                detail: ev.data?.reason ? `Reason: ${ev.data.reason}` : 'Hidden from public; kept for the record.',
            };

        case 'moderation_rejected':
            return {
                icon: 'rotate-ccw', color: 'text-green-600',
                message: `Removal rejected — ${ev.data?.target === 'comment' ? 'comment' : 'proposal'} restored`,
                detail: ev.data?.reason ? `Reason: ${ev.data.reason}` : '',
            };

        default:
            return {
                icon: 'activity', color: 'text-slate-400',
                message: ev.event_type?.replace(/_/g, ' ') || 'Event',
                detail: '',
            };
    }
}

function getTimerHTML(expiryDate, issueState) {
    const diff = expiryDate - new Date();
    const expired = diff <= 0 || issueState === 'closed';
    const days    = Math.max(0, Math.floor(diff / 86400000));
    const hours   = Math.max(0, Math.floor((diff % 86400000) / 3600000));
    const minutes = Math.max(0, Math.floor((diff % 3600000) / 60000));
    const seconds = Math.max(0, Math.floor((diff % 60000) / 1000));

    return `
 <div class="${issueState === 'closed' ? 'bg-slate-950 shadow-inner' : 'bg-blue-600 shadow-2xl'} p-10 rounded-[3rem] text-white relative overflow-hidden">
 <div class="absolute -right-4 -top-4 opacity-10">
 <i data-lucide="clock" class="w-24 h-24"></i>
        </div>
 <div class="flex items-center gap-3 mb-8 relative z-10">
 <i data-lucide="timer" class="w-4 h-4 opacity-50"></i>
 <h3 class="text-sm font-black uppercase tracking-[0.4em] opacity-80">Review Period</h3>
        </div>
        ${expired ? `
 <div class="relative z-10 py-2">
 <p class="text-4xl font-black italic tracking-tighter uppercase">COMPLETE</p>
 <div class="w-12 h-1 bg-white/20 my-4 rounded-full"></div>
 <p class="text-sm font-bold opacity-60 uppercase tracking-widest leading-relaxed">The 30-day review period has ended.</p>
        </div>
        ` : `
 <div class="grid grid-cols-4 gap-4 items-end relative z-10">
 <div><p class="text-4xl font-black italic tracking-tighter">${days}</p><p class="text-sm font-black uppercase opacity-50 mt-1 tracking-widest">Days</p></div>
 <div><p class="text-4xl font-black italic tracking-tighter">${hours}</p><p class="text-sm font-black uppercase opacity-50 mt-1 tracking-widest">Hrs</p></div>
 <div><p class="text-4xl font-black italic tracking-tighter">${minutes}</p><p class="text-sm font-black uppercase opacity-50 mt-1 tracking-widest">Min</p></div>
 <div class="text-blue-200"><p class="text-4xl font-black italic tracking-tighter">${seconds}</p><p class="text-sm font-black uppercase opacity-50 mt-1 tracking-widest">Sec</p></div>
        </div>
        `}
    </div>`;
}
