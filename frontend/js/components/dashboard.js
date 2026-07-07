import { renderCaptionedVideo } from './videoCaptions.js';

const WALKTHROUGH_VIDEO_URL = 'videos/walkthrough_clean.mp4';

const PROCESS_STEPS = [
    { num: 1, icon: 'wallet',         label: 'Connect Wallet',  desc: 'Sign in with any Cardano wallet — no account or password needed.', bg: 'bg-blue-500',   text: 'text-blue-500' },
    { num: 2, icon: 'book-open',      label: 'Browse & Select', desc: 'Read the Constitution and highlight the exact text you want to amend.', bg: 'bg-purple-500', text: 'text-purple-500' },
    { num: 3, icon: 'wand-2',         label: 'Submit',          desc: 'Use the Amendment Wizard to write your CAP or CIS, step by step.', bg: 'bg-amber-500',        text: 'text-amber-600' },
    { num: 4, icon: 'message-circle', label: 'Discuss & Track', desc: 'Your proposal goes public for consultation — track it through to ratification.', bg: 'bg-blue-500',   text: 'text-blue-500' },
];

export function renderDashboard(state) {
    const s = state.stats;

    const statCards = [
        { label: 'In Consultation', value: s.consultation, icon: 'message-circle', color: 'text-purple-600', bg: 'bg-purple-50 ', view: 'kanban' },
        { label: 'Ready',           value: s.ready,        icon: 'check-circle',   color: 'text-green-600',  bg: 'bg-green-50 ',   view: 'kanban' },
        { label: 'Done',            value: s.done,         icon: 'award',          color: 'text-emerald-500',bg: 'bg-emerald-50 ',view: 'list'   },
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
        <!-- Stats -->
 <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
            ${statCards.map(c => `
            <div onclick="window.setView('${c.view}')"
 class="bg-white/80 p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:border-blue-200 transition-all cursor-pointer">
 <div class="w-12 h-12 ${c.bg} ${c.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
 <i data-lucide="${c.icon}" class="w-6 h-6"></i>
                </div>
 <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">${c.label}</p>
 <p class="text-4xl font-black tracking-tighter text-slate-900 ">${c.value ?? '—'}</p>
            </div>
            `).join('')}
        </div>

        <!-- Actions -->
 <div class="flex flex-wrap gap-4">
            <button onclick="window.setView('wizard')"
 class="bg-brand-primary hover:bg-brand-primary-fixed-dim active:bg-brand-primary-active active:scale-[0.98] text-brand-on-primary px-10 h-12 rounded-full font-semibold uppercase text-xs tracking-widest transition-all shadow-[0_3px_8px_rgba(0,0,0,0.15)] flex items-center gap-3">
 <i data-lucide="wand-2" class="w-4 h-4"></i> Amendment Wizard
            </button>
            <button onclick="window.setView('constitution')"
 class="bg-transparent text-on-surface border-2 border-on-surface/40 hover:bg-white/10 px-10 h-12 rounded-full font-semibold uppercase text-xs tracking-widest transition-all flex items-center gap-3">
 <i data-lucide="book-open" class="w-4 h-4"></i> Read Constitution
            </button>
            <button onclick="window.setView('learn')"
 class="bg-transparent text-on-surface border-2 border-on-surface/40 hover:bg-white/10 px-10 h-12 rounded-full font-semibold uppercase text-xs tracking-widest transition-all flex items-center gap-3">
 <i data-lucide="graduation-cap" class="w-4 h-4"></i> Learn & Guide
            </button>
        </div>

        <!-- How it works -->
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
 <div class="flex items-center justify-between mb-8">
 <h2 class="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
 <i data-lucide="map" class="w-4 h-4 text-blue-500"></i> How It Works
                </h2>
 <button onclick="window.setView('learn')" class="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline">Learn More →</button>
            </div>
 <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                ${PROCESS_STEPS.map(step => `
 <div class="relative">
 <div class="w-10 h-10 rounded-2xl ${step.bg} ${step.bg === 'bg-amber-500' ? 'text-slate-900' : 'text-white'} flex items-center justify-center font-black text-sm mb-4">${step.num}</div>
 <div class="flex items-center gap-2 mb-2">
 <i data-lucide="${step.icon}" class="w-4 h-4 ${step.text}"></i>
 <p class="text-sm font-black text-slate-900 ">${step.label}</p>
                    </div>
 <p class="text-xs text-slate-400 leading-relaxed">${step.desc}</p>
                </div>
                `).join('')}
            </div>
        </div>

        <!-- Walkthrough video -->
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
 <h2 class="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2 mb-6">
 <i data-lucide="play-circle" class="w-4 h-4 text-purple-500"></i> Watch the Walkthrough
            </h2>
            ${renderCaptionedVideo(WALKTHROUGH_VIDEO_URL)}
        </div>

        <!-- Content grid -->
 <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Recent activity -->
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
 <div class="p-8 pb-4 flex items-center justify-between">
 <h2 class="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
 <i data-lucide="clock" class="w-4 h-4 text-blue-500"></i> Recent Activity
                    </h2>
                </div>
 <div class="divide-y divide-slate-50 ">
 ${recent.length === 0 ? `<p class="px-8 py-6 text-slate-400 text-sm">No proposals yet.</p>` : recent.map(p => `
                    <div onclick="window.openProposal(${p.number})"
 class="px-8 py-4 hover:bg-slate-50 cursor-pointer transition-colors">
 <div class="flex items-center gap-2 mb-1">
 <span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 uppercase">${p.type}</span>
 <span class="text-xs font-black text-slate-400">#${p.number}</span>
                        </div>
 <p class="text-sm font-bold text-slate-900 truncate">${escapeHtml(p.title)}</p>
 <p class="text-xs text-slate-400 mt-0.5">${timeAgo(p.updated_at)}</p>
                    </div>
                    `).join('')}
                </div>
            </div>

            <!-- Trending -->
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
 <div class="p-8 pb-4">
 <h2 class="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
 <i data-lucide="trending-up" class="w-4 h-4 text-amber-500"></i> Most Discussed
                    </h2>
                </div>
 <div class="divide-y divide-slate-50 ">
 ${trending.length === 0 ? `<p class="px-8 py-6 text-slate-400 text-sm">No open proposals yet.</p>` : trending.map(p => `
                    <div onclick="window.openProposal(${p.number})"
 class="px-8 py-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between gap-4">
 <div class="min-w-0">
 <p class="text-sm font-bold text-slate-900 truncate">${escapeHtml(p.title)}</p>
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
