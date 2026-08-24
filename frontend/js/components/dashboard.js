import { renderCaptionedVideo } from './videoCaptions.js';

const WALKTHROUGH_VIDEO_URL = 'videos/walkthrough_clean.webm';

const PROCESS_STEPS = [
    { num: 1, icon: 'wallet',         label: 'Connect Wallet',  desc: 'Sign in with any Cardano wallet — no account or password needed.', bg: 'bg-blue-500',   text: 'text-blue-500' },
    { num: 2, icon: 'book-open',      label: 'Browse & Select', desc: 'Read the Constitution and highlight the exact text you want to amend.', bg: 'bg-purple-500', text: 'text-purple-500' },
    { num: 3, icon: 'wand-2',         label: 'Submit',          desc: 'Write your CAP or CIS in a guided, step-by-step form.', bg: 'bg-amber-500',        text: 'text-amber-600' },
    { num: 4, icon: 'message-circle', label: 'Discuss & Track', desc: 'Your proposal goes public for consultation — track it through to ratification.', bg: 'bg-blue-500',   text: 'text-blue-500' },
];

export function renderDashboard(state) {
    const s = state.stats;

    const statCards = [
        { label: 'In Consultation', value: s.consultation, icon: 'message-circle', color: 'text-purple-600', bg: 'bg-purple-50 ', view: 'kanban' },
        { label: 'Ready',           value: s.ready,        icon: 'check-circle',   color: 'text-green-600',  bg: 'bg-green-50 ',   view: 'kanban' },
        { label: 'Done',            value: s.done,         icon: 'award',          color: 'text-emerald-500',bg: 'bg-emerald-50 ',view: 'list'   },
    ];

    const recentAll = state.proposals
        .slice()
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    const recent = recentAll.slice(0, 5);

    const trending = state.proposals
        .filter(p => p.state === 'open')
        .sort((a, b) => b.comments - a.comments)
        .slice(0, 5);

    return `
 <div class="space-y-12 fade-in text-left">
        <!-- Stats (compact: icon with label + number beside it) -->
 <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            ${statCards.map(c => `
            <div onclick="window.setView('${c.view}')"
 class="bg-white/80 px-6 py-4 rounded-2xl border border-slate-100 shadow-sm group hover:border-blue-200 transition-all cursor-pointer flex items-center gap-4">
 <div class="w-11 h-11 ${c.bg} ${c.color} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
 <i data-lucide="${c.icon}" class="w-5 h-5"></i>
                </div>
                <div>
 <p class="text-sm font-black uppercase tracking-[0.15em] text-slate-400">${c.label}</p>
 <p class="text-2xl font-black tracking-tighter text-slate-900 leading-none mt-0.5">${c.value ?? '—'}</p>
                </div>
            </div>
            `).join('')}
        </div>

        <!-- Recent activity & Most discussed (up top — the live pulse of the portal) -->
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
 <span class="text-sm font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 uppercase">${p.type}</span>
 <span class="text-sm font-black text-slate-400">#${p.number}</span>
                        </div>
 <p class="text-sm font-bold text-slate-900 truncate">${escapeHtml(p.title)}</p>
 <p class="text-sm text-slate-400 mt-0.5">${timeAgo(p.updated_at)}</p>
                    </div>
                    `).join('')}
                </div>
                ${recentAll.length > 5 ? `
                <button onclick="window.setView('list')"
 class="w-full px-8 py-4 border-t border-slate-100 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50/50 transition-colors">
                    See all proposals <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </button>` : ''}
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
 <p class="text-sm text-slate-400">#${p.number}</p>
                        </div>
 <div class="flex items-center gap-1 text-slate-400 flex-shrink-0 text-sm font-bold">
 <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> ${p.comments}
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- How it works -->
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
 <div class="flex items-center justify-between mb-8">
 <h2 class="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
 <i data-lucide="map" class="w-4 h-4 text-blue-500"></i> How It Works
                </h2>
 <button onclick="window.setView('learn')" class="text-sm font-black text-blue-600 uppercase tracking-widest hover:underline">Learn More →</button>
            </div>
 <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                ${PROCESS_STEPS.map(step => `
 <div class="relative">
 <div class="w-10 h-10 rounded-2xl ${step.bg} ${step.bg === 'bg-amber-500' ? 'text-slate-900' : 'text-white'} flex items-center justify-center font-black text-sm mb-4">${step.num}</div>
 <div class="flex items-center gap-2 mb-2">
 <i data-lucide="${step.icon}" class="w-4 h-4 ${step.text}"></i>
 <p class="text-sm font-black text-slate-900 ">${step.label}</p>
                    </div>
 <p class="text-sm text-slate-400 leading-relaxed">${step.desc}</p>
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
    </div>`;
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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
