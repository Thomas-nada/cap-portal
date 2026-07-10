import { LIFECYCLE, getStage } from '../lifecycle.js';
import { renderBoardColumns } from './kanban.js';

const STAGE_COLOR = {
    consultation: 'purple', ready: 'green', done: 'emerald', withdrawn: 'red',
};
const STAGE_BG = {
    consultation: 'bg-purple-100 text-purple-700 ',
    ready:        'bg-green-100 text-green-700 ',
    done:         'bg-emerald-100 text-emerald-700 ',
    withdrawn:    'bg-red-100 text-red-700 ',
};

export function renderRegistry(state) {
    const tab = state.proposalsTab === 'board' ? 'board' : 'list';
    const search = (state.registrySearch || '').toLowerCase();
    const stageFilter = state.stageFilter || 'all';
    const typeFilter = state.docTypeFilter || 'ALL';

    let proposals = state.proposals;
    // Board columns ARE the stages, so the stage filter only applies in list view.
    if (tab === 'list' && stageFilter !== 'all') proposals = proposals.filter(p => getStage(p) === stageFilter);
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
    // Hover tooltips so people know what each filter means.
    const STAGE_DESC = {
        all:          'Proposals in every stage',
        consultation: 'Open for community discussion',
        ready:        'Author has signalled ready; under editor review',
        done:         'Finalised and closed',
        withdrawn:    'Withdrawn by the author or editors',
    };
    const TYPE_DESC = {
        ALL: 'Both CAPs and Constitutional Issue Statements',
        CAP: 'Constitutional Amendment Proposal — proposes specific changes to the Constitution text',
        CIS: 'Constitutional Issue Statement — raises a problem without proposing specific text',
    };

    return `
 <div class="fade-in space-y-6">
 <div class="flex flex-col gap-4">
 <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-on-surface ">Proposals</h1>
 <div class="flex items-center gap-2 w-full sm:w-auto">
                    <input type="text" placeholder="Search by title, author, label…" value="${escapeHtml(state.registrySearch || '')}"
                        oninput="window.setRegistrySearch(this.value)"
 class="px-4 py-2 rounded-xl border border-slate-200 bg-white/80 text-sm text-slate-900 outline-none focus:border-blue-400 w-full sm:w-64">
                    ${state.user ? `<button onclick="window.setView('wizard')"
 class="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">
 <i data-lucide="plus" class="w-4 h-4"></i> New Proposal
                    </button>` : ''}
                </div>
            </div>
 <div class="flex flex-wrap gap-2 items-center">
                ${tab === 'list' ? `${STAGES.map(s => `
                <button onclick="state.stageFilter='${s}'; window.updateUI()" title="${STAGE_DESC[s]}"
 class="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition-all
                    ${(state.stageFilter||'all')===s ? STAGE_ACTIVE[s] : 'bg-white/80 border border-slate-200 text-slate-500 hover:text-slate-900 '}">
                    ${s}${s !== 'all' ? ` <i data-lucide="info" class="w-3 h-3 opacity-60"></i>` : ''}
                </button>`).join('')}
 <div class="w-px bg-slate-200 mx-1"></div>` : ''}
                ${['ALL','CAP','CIS'].map(t => `
                <button onclick="state.docTypeFilter='${t}'; window.updateUI()" title="${TYPE_DESC[t]}"
 class="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition-all
                    ${(state.docTypeFilter||'ALL')===t ? 'bg-slate-900 text-white ' : 'bg-white/80 border border-slate-200 text-slate-500 hover:text-slate-900 '}">
                    ${t}${t !== 'ALL' ? ` <i data-lucide="info" class="w-3 h-3 opacity-60"></i>` : ''}
                </button>`).join('')}
            </div>
        </div>

        <!-- Count, then the list/board view toggle below it -->
 <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <p class="text-sm text-on-surface-variant font-bold">${proposals.length} proposal${proposals.length !== 1 ? 's' : ''}</p>
 <div class="inline-flex rounded-xl border border-slate-200 bg-white/80 p-1 self-start sm:self-auto">
                ${[['list','list','List'],['board','layout-dashboard','Board']].map(([id, icon, label]) => `
                <button onclick="window.setProposalsTab('${id}')"
 class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}">
 <i data-lucide="${icon}" class="w-4 h-4"></i> ${label}
                </button>`).join('')}
            </div>
        </div>

        ${tab === 'board' ? renderBoardColumns(proposals) : `
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            ${proposals.length === 0
 ? `<div class="py-20 text-center text-slate-400">
 <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-4 opacity-30"></i>
 <p class="font-bold">No proposals found</p>
                   </div>`
                : proposals.map(p => renderRow(p)).join('')
            }
        </div>
        `}
    </div>`;
}

function renderRow(p) {
    const stage = getStage(p);
    const stageBg = STAGE_BG[stage] || 'bg-slate-100 text-slate-600';
    // Exclude lifecycle labels and the label that duplicates the document-type badge (CAP/CIS).
    const nonLifecycleLabels = (p.labels || []).filter(l => !LIFECYCLE.includes(l.name.toLowerCase()) && l.name !== p.type);

    return `
    <div onclick="window.openProposal(${p.number})"
 class="flex items-center gap-4 px-4 sm:px-8 py-5 border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors">
 <div class="flex-shrink-0 w-10 text-right">
 <span class="text-sm font-black text-slate-300 ">#${p.number}</span>
        </div>
 <div class="min-w-0 flex-1">
 <div class="flex items-center gap-2 mb-1 flex-wrap">
 <span class="text-sm font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 uppercase">${p.type}</span>
 <span class="text-sm font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${stageBg}">${stage}</span>
                ${nonLifecycleLabels.slice(0, 3).map(l =>
 `<span class="text-sm font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">${escapeHtml(l.name)}</span>`
                ).join('')}
            </div>
 <p class="text-sm font-bold text-slate-900 truncate">${escapeHtml(p.title)}</p>
 <p class="text-sm text-slate-400 mt-0.5">${timeAgo(p.updated_at)}</p>
        </div>
 <div class="flex items-center gap-3 flex-shrink-0 text-sm text-slate-400 font-bold">
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
