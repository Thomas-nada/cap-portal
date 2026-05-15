const LIFECYCLE = ['consultation', 'ready', 'done', 'withdrawn'];

function getStage(p) {
    const lc = (p.labels || []).map(l => l.name.toLowerCase());
    for (const s of LIFECYCLE) { if (lc.includes(s)) return s; }
    return p.state === 'closed' ? 'done' : 'consultation';
}

const STAGE_COLOR = {
    consultation: 'purple', ready: 'green', done: 'emerald', withdrawn: 'red',
};
const STAGE_BG = {
    consultation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    ready:        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    done:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    withdrawn:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export function renderRegistry(state) {
    const search = (state.registrySearch || '').toLowerCase();
    const stageFilter = state.stageFilter || 'all';
    const typeFilter = state.docTypeFilter || 'ALL';

    let proposals = state.proposals;
    if (stageFilter !== 'all') proposals = proposals.filter(p => getStage(p) === stageFilter);
    if (typeFilter !== 'ALL') proposals = proposals.filter(p => p.type === typeFilter);
    if (search) {
        proposals = proposals.filter(p =>
            (p.title || '').toLowerCase().includes(search) ||
            String(p.number).includes(search) ||
            (p.author_display_name || '').toLowerCase().includes(search) ||
            (p.labels || []).some(l => l.name.toLowerCase().includes(search))
        );
    }

    const STAGES = ['all', 'consultation', 'ready', 'done', 'withdrawn'];
    const STAGE_ACTIVE = {
        all:          'bg-blue-600 text-white',
        consultation: 'bg-purple-600 text-white',
        ready:        'bg-green-600 text-white',
        done:         'bg-emerald-600 text-white',
        withdrawn:    'bg-red-600 text-white',
    };

    return `
    <div class="fade-in space-y-6">
        <div class="flex flex-col gap-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 class="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">Proposal Registry</h1>
                <div class="flex items-center gap-2">
                    <input type="text" placeholder="Search by title, author, label…" value="${escapeHtml(state.registrySearch || '')}"
                        oninput="window.setRegistrySearch(this.value)"
                        class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400 w-64">
                </div>
            </div>
            <div class="flex flex-wrap gap-2">
                ${STAGES.map(s => `
                <button onclick="state.stageFilter='${s}'; window.updateUI()"
                    class="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all
                    ${(state.stageFilter||'all')===s ? STAGE_ACTIVE[s] : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white'}">
                    ${s}
                </button>`).join('')}
                <div class="w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                ${['ALL','CAP','CIS'].map(t => `
                <button onclick="state.docTypeFilter='${t}'; window.updateUI()"
                    class="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all
                    ${(state.docTypeFilter||'ALL')===t ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white'}">
                    ${t}
                </button>`).join('')}
            </div>
        </div>

        <p class="text-xs text-slate-400 font-bold">${proposals.length} proposal${proposals.length !== 1 ? 's' : ''}</p>

        <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            ${proposals.length === 0
                ? `<div class="py-20 text-center text-slate-400">
                    <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-4 opacity-30"></i>
                    <p class="font-bold">No proposals found</p>
                   </div>`
                : proposals.map(p => renderRow(p)).join('')
            }
        </div>
    </div>`;
}

function renderRow(p) {
    const stage = getStage(p);
    const stageBg = STAGE_BG[stage] || 'bg-slate-100 text-slate-600';
    const nonLifecycleLabels = (p.labels || []).filter(l => !LIFECYCLE.includes(l.name.toLowerCase()));

    return `
    <div onclick="window.openProposal(${p.number})"
        class="flex items-center gap-4 px-8 py-5 border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
        <div class="flex-shrink-0 w-10 text-right">
            <span class="text-xs font-black text-slate-300 dark:text-slate-600">#${p.number}</span>
        </div>
        <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 uppercase">${p.type}</span>
                <span class="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${stageBg}">${stage}</span>
                ${nonLifecycleLabels.slice(0, 3).map(l =>
                    `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">${escapeHtml(l.name)}</span>`
                ).join('')}
            </div>
            <p class="text-sm font-bold text-slate-900 dark:text-white truncate">${escapeHtml(p.title)}</p>
            <p class="text-xs text-slate-400 mt-0.5">${timeAgo(p.updated_at)}</p>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0 text-xs text-slate-400 font-bold">
            <span class="flex items-center gap-1"><i data-lucide="message-circle" class="w-3.5 h-3.5"></i> ${p.comments}</span>
            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300"></i>
        </div>
    </div>`;
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function timeAgo(iso) {
    if (!iso) return '';
    const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (d === 0) return 'today';
    if (d === 1) return 'yesterday';
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
}
