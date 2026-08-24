function escapeHtml(str) {
    // Escape quotes too: values land in attribute contexts (href/src/value),
    // where an unescaped " or ' breaks out of the attribute.
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// True only for well-formed image data: URLs. Anything else (in particular a
// value containing a quote, which could break out of a src/href attribute) is
// rejected before it reaches innerHTML.
function isSafeImageDataUrl(s) {
    return typeof s === 'string' && /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(s);
}

function statusBadge(status) {
    const map = {
        open:        { label: 'Open',        cls: 'bg-red-100 text-red-700 ' },
        in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700 ' },
        resolved:    { label: 'Resolved',    cls: 'bg-green-100 text-green-700 ' },
    };
    const s = map[status] || map.open;
 return `<span class="px-3 py-1 rounded-full text-sm font-black uppercase tracking-widest ${s.cls}">${s.label}</span>`;
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function renderBugs(state) {
    if (!state.user?.is_admin) {
        return `
 <div class="text-center py-24">
 <div class="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
 <i data-lucide="lock" class="w-8 h-8 text-on-surface-variant"></i>
            </div>
 <h2 class="text-2xl font-black tracking-tighter text-on-surface mb-2">Admin Only</h2>
 <p class="text-on-surface-variant">You need admin access to view bug reports.</p>
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
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
 <div class="flex items-start justify-between gap-4 mb-3">
 <div class="flex-1 min-w-0">
 <div class="flex items-center gap-3 mb-1">
                        ${statusBadge(r.status)}
 <span class="text-sm text-slate-400">#${r.id} · ${formatDate(r.created_at)}</span>
                    </div>
 <h3 class="font-black text-lg text-slate-900 ">${escapeHtml(r.title)}</h3>
 <p class="text-sm text-slate-400 mt-0.5">Reported by ${escapeHtml(r.reporter_display_name || r.reporter_stake_address.slice(0,20) + '…')}</p>
                </div>
            </div>
 <p class="text-slate-600 text-sm whitespace-pre-wrap mb-4">${escapeHtml(r.description)}</p>
            ${r.environment ? `
 <div class="bg-slate-50 rounded-2xl px-5 py-4 mb-4 text-sm font-mono space-y-1">
 <p class="text-sm font-black text-slate-500 uppercase tracking-widest mb-2 font-sans">Environment</p>
 ${r.environment.page ? `<div class="flex gap-2"><span class="text-slate-400 w-24 shrink-0">Page</span><span class="text-slate-700 break-all">${escapeHtml(r.environment.page)}</span></div>` : ''}
 ${r.environment.viewport ? `<div class="flex gap-2"><span class="text-slate-400 w-24 shrink-0">Viewport</span><span class="text-slate-700 ">${escapeHtml(r.environment.viewport)}</span></div>` : ''}
 ${r.environment.user_agent ? `<div class="flex gap-2"><span class="text-slate-400 w-24 shrink-0">User-Agent</span><span class="text-slate-700 break-all">${escapeHtml(r.environment.user_agent)}</span></div>` : ''}
 ${r.environment.logged_in !== undefined ? `<div class="flex gap-2"><span class="text-slate-400 w-24 shrink-0">Logged in</span><span class="text-slate-700 ">${r.environment.logged_in ? 'Yes' : 'No'}</span></div>` : ''}
 ${r.environment.username ? `<div class="flex gap-2"><span class="text-slate-400 w-24 shrink-0">User</span><span class="text-slate-700 ">${escapeHtml(r.environment.username)}</span></div>` : ''}
 ${r.environment.timestamp ? `<div class="flex gap-2"><span class="text-slate-400 w-24 shrink-0">Timestamp</span><span class="text-slate-700 ">${escapeHtml(r.environment.timestamp)}</span></div>` : ''}
            </div>` : ''}
 ${(r.screenshots || []).length ? `
 <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                ${r.screenshots.filter(isSafeImageDataUrl).map(s => `<a href="${s}" target="_blank" rel="noopener"><img src="${s}" class="w-full max-h-64 object-contain rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors"></a>`).join('')}
            </div>` : ''}
 <div class="flex flex-wrap gap-2">
                ${r.status !== 'open' ? `
                <button onclick="window.updateBugStatus(${r.id}, 'open')"
 class="px-4 py-2 rounded-2xl text-sm font-black border-2 border-slate-200 hover:border-red-300 hover:text-red-600 transition-all">
                    Mark Open
                </button>` : ''}
                ${r.status !== 'in_progress' ? `
                <button onclick="window.updateBugStatus(${r.id}, 'in_progress')"
 class="px-4 py-2 rounded-2xl text-sm font-black border-2 border-slate-200 hover:border-amber-300 hover:text-amber-600 transition-all">
                    In Progress
                </button>` : ''}
                ${r.status !== 'resolved' ? `
                <button onclick="window.updateBugStatus(${r.id}, 'resolved')"
 class="px-4 py-2 rounded-2xl text-sm font-black border-2 border-slate-200 hover:border-green-300 hover:text-green-600 transition-all">
                    Mark Resolved
                </button>` : ''}
            </div>
        </div>`).join('');

    return `
 <div class="space-y-8">
 <div class="flex items-center justify-between">
            <div>
 <h1 class="text-3xl font-black italic tracking-tighter text-on-surface uppercase">Bug Reports</h1>
 <p class="text-on-surface-variant mt-1">Submitted by portal users</p>
            </div>
        </div>

 <div class="grid grid-cols-3 gap-4">
 <div class="bg-red-50 rounded-[2rem] p-6 text-center">
 <p class="text-3xl font-black text-red-600 ">${open}</p>
 <p class="text-sm font-black text-red-500 uppercase tracking-widest mt-1">Open</p>
            </div>
 <div class="bg-amber-50 rounded-[2rem] p-6 text-center">
 <p class="text-3xl font-black text-amber-600 ">${inProgress}</p>
 <p class="text-sm font-black text-amber-500 uppercase tracking-widest mt-1">In Progress</p>
            </div>
 <div class="bg-green-50 rounded-[2rem] p-6 text-center">
 <p class="text-3xl font-black text-green-600 ">${resolved}</p>
 <p class="text-sm font-black text-green-500 uppercase tracking-widest mt-1">Resolved</p>
            </div>
        </div>

 <div class="space-y-4">
            ${reportCards}
        </div>
    </div>`;
}
