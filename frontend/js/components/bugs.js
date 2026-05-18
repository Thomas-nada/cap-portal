function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function statusBadge(status) {
    const map = {
        open:        { label: 'Open',        cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
        in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
        resolved:    { label: 'Resolved',    cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    };
    const s = map[status] || map.open;
    return `<span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${s.cls}">${s.label}</span>`;
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function renderBugs(state) {
    if (!state.user?.is_admin) {
        return `
        <div class="text-center py-24">
            <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <i data-lucide="lock" class="w-8 h-8 text-slate-400"></i>
            </div>
            <h2 class="text-2xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">Admin Only</h2>
            <p class="text-slate-500">You need admin access to view bug reports.</p>
        </div>`;
    }

    const reports = state.bugReports || [];
    const open       = reports.filter(r => r.status === 'open').length;
    const inProgress = reports.filter(r => r.status === 'in_progress').length;
    const resolved   = reports.filter(r => r.status === 'resolved').length;

    const reportCards = reports.length === 0
        ? `<div class="text-center py-20 text-slate-400">
               <i data-lucide="check-circle" class="w-12 h-12 mx-auto mb-4 opacity-30"></i>
               <p class="font-bold">No bug reports yet</p>
           </div>`
        : reports.map(r => `
        <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-8">
            <div class="flex items-start justify-between gap-4 mb-3">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-1">
                        ${statusBadge(r.status)}
                        <span class="text-xs text-slate-400">#${r.id} · ${formatDate(r.created_at)}</span>
                    </div>
                    <h3 class="font-black text-lg text-slate-900 dark:text-white">${escapeHtml(r.title)}</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Reported by ${escapeHtml(r.reporter_display_name || r.reporter_stake_address.slice(0,20) + '…')}</p>
                </div>
            </div>
            <p class="text-slate-600 dark:text-slate-400 text-sm whitespace-pre-wrap mb-4">${escapeHtml(r.description)}</p>
            ${r.screenshot ? `<img src="${r.screenshot}" class="w-full max-h-64 object-contain rounded-2xl border border-slate-200 dark:border-slate-700 mb-4">` : ''}
            <div class="flex flex-wrap gap-2">
                ${r.status !== 'open' ? `
                <button onclick="window.updateBugStatus(${r.id}, 'open')"
                    class="px-4 py-2 rounded-2xl text-xs font-black border-2 border-slate-200 dark:border-slate-700 hover:border-red-300 hover:text-red-600 transition-all">
                    Mark Open
                </button>` : ''}
                ${r.status !== 'in_progress' ? `
                <button onclick="window.updateBugStatus(${r.id}, 'in_progress')"
                    class="px-4 py-2 rounded-2xl text-xs font-black border-2 border-slate-200 dark:border-slate-700 hover:border-amber-300 hover:text-amber-600 transition-all">
                    In Progress
                </button>` : ''}
                ${r.status !== 'resolved' ? `
                <button onclick="window.updateBugStatus(${r.id}, 'resolved')"
                    class="px-4 py-2 rounded-2xl text-xs font-black border-2 border-slate-200 dark:border-slate-700 hover:border-green-300 hover:text-green-600 transition-all">
                    Mark Resolved
                </button>` : ''}
            </div>
        </div>`).join('');

    return `
    <div class="space-y-8">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase">Bug Reports</h1>
                <p class="text-slate-500 mt-1">Submitted by portal users</p>
            </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
            <div class="bg-red-50 dark:bg-red-900/20 rounded-[2rem] p-6 text-center">
                <p class="text-3xl font-black text-red-600 dark:text-red-400">${open}</p>
                <p class="text-xs font-black text-red-500 uppercase tracking-widest mt-1">Open</p>
            </div>
            <div class="bg-amber-50 dark:bg-amber-900/20 rounded-[2rem] p-6 text-center">
                <p class="text-3xl font-black text-amber-600 dark:text-amber-400">${inProgress}</p>
                <p class="text-xs font-black text-amber-500 uppercase tracking-widest mt-1">In Progress</p>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 rounded-[2rem] p-6 text-center">
                <p class="text-3xl font-black text-green-600 dark:text-green-400">${resolved}</p>
                <p class="text-xs font-black text-green-500 uppercase tracking-widest mt-1">Resolved</p>
            </div>
        </div>

        <div class="space-y-4">
            ${reportCards}
        </div>
    </div>`;
}
