import { shortAddress } from '../wallet.js';

export function renderDashboard(state) {
    const s = state.stats;
    const user = state.user;

    const statCards = [
        { label: 'In Consultation', value: s.consultation, icon: 'message-circle', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', view: 'kanban' },
        { label: 'Ready',           value: s.ready,        icon: 'check-circle',   color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20',   view: 'kanban' },
        { label: 'Done',            value: s.done,         icon: 'award',          color: 'text-emerald-500',bg: 'bg-emerald-50 dark:bg-emerald-900/20',view: 'list'   },
    ];

    const recent = state.proposals
        .slice()
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 8);

    const trending = state.proposals
        .filter(p => p.state === 'open')
        .sort((a, b) => b.comments - a.comments)
        .slice(0, 5);

    return `
    <div class="space-y-12 fade-in text-left">
        <header>
            <h1 class="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
                ${user
                    ? `Welcome, <span class="text-blue-600">${user.display_name || shortAddress(user.stake_address)}</span>.`
                    : 'CAP Portal'}
            </h1>
            <p class="text-slate-400 text-sm font-black mt-2 uppercase tracking-[0.2em]">Put your CAP on!</p>
        </header>

        <!-- Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
            ${statCards.map(c => `
            <div onclick="window.setView('${c.view}')"
                class="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-blue-200 dark:hover:border-blue-900/30 transition-all cursor-pointer">
                <div class="w-12 h-12 ${c.bg} ${c.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <i data-lucide="${c.icon}" class="w-6 h-6"></i>
                </div>
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">${c.label}</p>
                <p class="text-4xl font-black italic tracking-tighter text-slate-900 dark:text-white">${c.value ?? '—'}</p>
            </div>
            `).join('')}
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-4">
            <button onclick="window.setView('wizard')"
                class="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-widest hover:-translate-y-1 active:scale-95 transition-all shadow-xl flex items-center gap-3">
                <i data-lucide="wand-2" class="w-4 h-4"></i> Amendment Wizard
            </button>
            <button onclick="window.setView('constitution')"
                class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-widest hover:-translate-y-1 active:scale-95 transition-all shadow-sm flex items-center gap-3">
                <i data-lucide="book-open" class="w-4 h-4 text-blue-600"></i> Read Constitution
            </button>
            <button onclick="window.setView('learn')"
                class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-widest hover:-translate-y-1 active:scale-95 transition-all shadow-sm flex items-center gap-3">
                <i data-lucide="graduation-cap" class="w-4 h-4 text-amber-600"></i> Learn & Guide
            </button>
        </div>

        <!-- Content grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Recent activity -->
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div class="p-8 pb-4 flex items-center justify-between">
                    <h2 class="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                        <i data-lucide="clock" class="w-4 h-4 text-blue-500"></i> Recent Activity
                    </h2>
                </div>
                <div class="divide-y divide-slate-50 dark:divide-slate-800">
                    ${recent.length === 0 ? `<p class="px-8 py-6 text-slate-400 text-sm">No proposals yet.</p>` : recent.map(p => `
                    <div onclick="window.openProposal(${p.number})"
                        class="px-8 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 uppercase">${p.type}</span>
                            <span class="text-xs font-black text-slate-400">#${p.number}</span>
                        </div>
                        <p class="text-sm font-bold text-slate-900 dark:text-white truncate">${escapeHtml(p.title)}</p>
                        <p class="text-xs text-slate-400 mt-0.5">${timeAgo(p.updated_at)}</p>
                    </div>
                    `).join('')}
                </div>
            </div>

            <!-- Trending -->
            <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div class="p-8 pb-4">
                    <h2 class="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                        <i data-lucide="trending-up" class="w-4 h-4 text-amber-500"></i> Most Discussed
                    </h2>
                </div>
                <div class="divide-y divide-slate-50 dark:divide-slate-800">
                    ${trending.length === 0 ? `<p class="px-8 py-6 text-slate-400 text-sm">No open proposals yet.</p>` : trending.map(p => `
                    <div onclick="window.openProposal(${p.number})"
                        class="px-8 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors flex items-center justify-between gap-4">
                        <div class="min-w-0">
                            <p class="text-sm font-bold text-slate-900 dark:text-white truncate">${escapeHtml(p.title)}</p>
                            <p class="text-xs text-slate-400">#${p.number}</p>
                        </div>
                        <div class="flex items-center gap-1 text-slate-400 flex-shrink-0 text-xs font-bold">
                            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> ${p.comments}
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>`;
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}
