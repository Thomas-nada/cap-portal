// Admin moderation queue — review editor removal requests.

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function timeAgo(iso) {
    if (!iso) return '';
    const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(iso).toLocaleDateString();
}

const STATUS_TABS = [
    { id: 'open', label: 'Open' },
    { id: 'removed', label: 'Removed' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'all', label: 'All' },
];

export function renderModeration(state) {
    if (!state.user?.is_admin) {
        return `<div class="fade-in py-20 text-center text-on-surface-variant font-bold">Admins only.</div>`;
    }
    const filter = state.moderationFilter || 'open';
    const cases = state.moderationCases || [];

    return `
 <div class="fade-in space-y-8">
 <div>
 <h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-on-surface">Moderation Queue</h1>
 <p class="text-sm text-on-surface-variant font-bold mt-2">Review content flagged for removal. Removing or rejecting both require a written reason and notify the author and the editor who flagged it.</p>
        </div>

 <div class="flex flex-wrap gap-2">
            ${STATUS_TABS.map(t => `
            <button onclick="window.setModerationFilter('${t.id}')"
 class="px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition-all ${filter === t.id ? 'bg-blue-600 text-white' : 'bg-white/80 border border-slate-200 text-slate-500 hover:text-slate-900'}">
                ${t.label}
            </button>`).join('')}
        </div>

        ${state.loading?.moderation ? `<div class="loading-spinner"></div>` : cases.length === 0 ? `
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 p-16 text-center">
 <i data-lucide="shield-check" class="w-12 h-12 mx-auto mb-4 text-slate-300"></i>
 <p class="font-black text-slate-500">Nothing here.</p>
 <p class="text-sm text-slate-400 mt-1">No ${filter === 'all' ? '' : filter} moderation cases.</p>
        </div>` : `
 <div class="space-y-5">
            ${cases.map(c => renderCase(c)).join('')}
        </div>`}

        <!-- Danger zone -->
 <div class="mt-12 rounded-[2rem] border-2 border-red-200 bg-red-50/40 p-6 sm:p-8">
 <h2 class="text-sm font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
 <i data-lucide="alert-triangle" class="w-4 h-4"></i> Danger zone
            </h2>
 <div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
 <p class="text-sm font-black text-slate-900">Reset all proposals</p>
 <p class="text-sm text-slate-500 mt-1 max-w-xl">Permanently deletes every proposal and everything attached to it (comments, labels, audit trail, versions, suggestions). Editors, admins, users and guides are kept. Numbering restarts at #1. This cannot be undone.</p>
                </div>
                <button onclick="window.confirmResetProposals()"
 class="flex-shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors">
 <i data-lucide="trash-2" class="w-4 h-4"></i> Reset proposals
                </button>
            </div>
        </div>
    </div>`;
}

function renderCase(c) {
    const isOpen = c.status === 'open';
    const kindLabel = c.target_type === 'comment' ? 'Comment' : 'Proposal';
    const statusPill = {
        open: 'bg-amber-100 text-amber-700',
        removed: 'bg-red-100 text-red-700',
        rejected: 'bg-green-100 text-green-700',
    }[c.status] || 'bg-slate-100 text-slate-600';

    const targetBlock = c.target_type === 'comment'
        ? `<div class="text-sm text-slate-700 bg-slate-50 rounded-2xl p-4 border border-slate-100 whitespace-pre-wrap">${escapeHtml(c.target_preview || '(comment unavailable)')}</div>`
        : `<div class="text-sm font-bold text-slate-900">${escapeHtml(c.target_title || '(proposal unavailable)')}</div>`;

    return `
 <div class="bg-white/90 rounded-[2rem] border border-slate-100 shadow-sm p-6 sm:p-8 space-y-4">
 <div class="flex items-center gap-3 flex-wrap">
 <span class="text-sm font-black px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wider">${kindLabel}</span>
 <span class="text-sm font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${statusPill}">${escapeHtml(c.status)}</span>
 <a onclick="window.openProposal(${c.proposal_number})" class="text-sm font-black text-blue-600 hover:underline cursor-pointer">CAP #${c.proposal_number}</a>
 <span class="text-sm text-slate-400 font-bold ml-auto">${timeAgo(c.created_at)}</span>
        </div>

 <div>
 <p class="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Flagged content — by ${escapeHtml(c.target_author || 'unknown')}</p>
            ${targetBlock}
        </div>

 <div>
 <p class="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Editor's reason — ${escapeHtml(c.flagged_by_name || 'an editor')}</p>
 <p class="text-sm text-slate-700 italic">"${escapeHtml(c.flag_reason)}"</p>
        </div>

        ${c.status !== 'open' && c.resolution_reason ? `
 <div class="pt-2 border-t border-slate-100">
 <p class="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Admin decision — ${escapeHtml(c.resolved_by_name || 'admin')}</p>
 <p class="text-sm text-slate-700 italic">"${escapeHtml(c.resolution_reason)}"</p>
        </div>` : ''}

        ${isOpen ? `
 <div class="flex gap-3 pt-2">
            <button onclick="window.moderationResolve(${c.id}, 'remove')"
 class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm uppercase tracking-wider transition-colors">
 <i data-lucide="ban" class="w-4 h-4"></i> Remove
            </button>
            <button onclick="window.moderationResolve(${c.id}, 'reject')"
 class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black text-sm uppercase tracking-wider transition-colors">
 <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Reject &amp; Restore
            </button>
        </div>` : ''}
    </div>`;
}
