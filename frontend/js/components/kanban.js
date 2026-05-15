const LIFECYCLE = ['consultation', 'ready', 'done', 'withdrawn'];

function getStage(p) {
    const lc = (p.labels || []).map(l => l.name.toLowerCase());
    for (const s of LIFECYCLE) { if (lc.includes(s)) return s; }
    return p.state === 'closed' ? 'done' : 'consultation';
}

const COLUMNS = [
    { id: 'consultation', label: 'In Consultation', icon: 'message-circle', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800' },
    { id: 'ready',        label: 'Ready',           icon: 'check-circle',   color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20',   border: 'border-green-200 dark:border-green-800' },
    { id: 'done',         label: 'Done',            icon: 'award',          color: 'text-emerald-500',bg: 'bg-emerald-50 dark:bg-emerald-900/20',border: 'border-emerald-200 dark:border-emerald-800' },
    { id: 'withdrawn',    label: 'Withdrawn',       icon: 'x-circle',       color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/20',        border: 'border-red-200 dark:border-red-800' },
];

export function renderKanban(state) {
    const typeFilter = state.docTypeFilter || 'ALL';
    let proposals = state.proposals;
    if (typeFilter !== 'ALL') proposals = proposals.filter(p => p.type === typeFilter);

    const byStage = {};
    for (const col of COLUMNS) byStage[col.id] = [];
    for (const p of proposals) byStage[getStage(p)].push(p);

    return `
    <div class="fade-in">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">Board</h1>
            <div class="flex items-center gap-2">
                ${['ALL','CAP','CIS'].map(t => `
                <button onclick="state.docTypeFilter='${t}'; window.updateUI()"
                    class="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all
                    ${(state.docTypeFilter||'ALL')===t ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white'}">
                    ${t}
                </button>`).join('')}
            </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            ${COLUMNS.map(col => `
            <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2 px-1">
                    <div class="w-7 h-7 ${col.bg} ${col.color} rounded-lg flex items-center justify-center flex-shrink-0">
                        <i data-lucide="${col.icon}" class="w-3.5 h-3.5"></i>
                    </div>
                    <span class="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">${col.label}</span>
                    <span class="ml-auto text-xs font-black text-slate-300 dark:text-slate-600">${byStage[col.id].length}</span>
                </div>
                ${byStage[col.id].length === 0
                    ? `<div class="rounded-[2rem] border-2 border-dashed ${col.border} p-8 text-center text-slate-300 dark:text-slate-700 text-xs font-bold">Empty</div>`
                    : byStage[col.id].map(p => renderCard(p)).join('')
                }
            </div>
            `).join('')}
        </div>
    </div>`;
}

function renderCard(p) {
    const nonLifecycle = (p.labels || []).filter(l => !LIFECYCLE.includes(l.name.toLowerCase()));
    return `
    <div onclick="window.openProposal(${p.number})"
        class="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 p-5 cursor-pointer hover:border-blue-200 dark:hover:border-blue-900 hover:shadow-md transition-all group">
        <div class="flex items-center gap-2 mb-3 flex-wrap">
            <span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 uppercase">${p.type}</span>
            <span class="text-[9px] font-black text-slate-300 dark:text-slate-600">#${p.number}</span>
            ${nonLifecycle.slice(0, 2).map(l =>
                `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">${escapeHtml(l.name)}</span>`
            ).join('')}
        </div>
        <p class="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">${escapeHtml(p.title)}</p>
        <div class="flex items-center gap-3 mt-3 text-xs text-slate-400 font-bold">
            <span>${timeAgo(p.updated_at)}</span>
            <span class="flex items-center gap-1 ml-auto"><i data-lucide="message-circle" class="w-3 h-3"></i>${p.comments}</span>
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
