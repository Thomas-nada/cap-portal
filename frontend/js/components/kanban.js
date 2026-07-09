import { LIFECYCLE, getStage } from '../lifecycle.js';

const COLUMNS = [
    { id: 'consultation', label: 'In Consultation', icon: 'message-circle', color: 'text-purple-600', bg: 'bg-purple-50 ', border: 'border-purple-200 ' },
    { id: 'ready',        label: 'Ready',           icon: 'check-circle',   color: 'text-green-600',  bg: 'bg-green-50 ',   border: 'border-green-200 ' },
    { id: 'done',         label: 'Done',            icon: 'award',          color: 'text-emerald-500',bg: 'bg-emerald-50 ',border: 'border-emerald-200 ' },
    { id: 'withdrawn',    label: 'Withdrawn',       icon: 'x-circle',       color: 'text-red-500',    bg: 'bg-red-50 ',        border: 'border-red-200 ' },
];

// Stage columns for the Proposals page's Board tab. Page chrome (heading,
// search, filters, tab toggle) lives in registry.js; this renders only the
// columns for an already-filtered list of proposals.
export function renderBoardColumns(proposals) {
    const byStage = {};
    for (const col of COLUMNS) byStage[col.id] = [];
    for (const p of proposals) byStage[getStage(p)].push(p);

    return `
 <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        ${COLUMNS.map(col => `
 <div class="flex flex-col gap-3">
 <div class="flex items-center gap-2 px-1">
 <div class="w-7 h-7 ${col.bg} ${col.color} rounded-lg flex items-center justify-center flex-shrink-0">
 <i data-lucide="${col.icon}" class="w-3.5 h-3.5"></i>
                </div>
 <span class="text-sm font-black uppercase tracking-widest text-slate-500">${col.label}</span>
 <span class="ml-auto text-sm font-black text-slate-400">${byStage[col.id].length}</span>
            </div>
            ${byStage[col.id].length === 0
 ? `<div class="rounded-[2rem] border-2 border-dashed border-slate-200 p-8 text-center text-slate-400 text-sm font-bold">Empty</div>`
                : byStage[col.id].map(p => renderCard(p)).join('')
            }
        </div>
        `).join('')}
    </div>`;
}

function renderCard(p) {
    // Exclude lifecycle labels and the label that duplicates the document-type badge (CAP/CIS).
    const nonLifecycle = (p.labels || []).filter(l => !LIFECYCLE.includes(l.name.toLowerCase()) && l.name !== p.type);
    return `
    <div onclick="window.openProposal(${p.number})"
 class="bg-white/80 rounded-[1.5rem] border border-slate-100 p-5 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all group">
 <div class="flex items-center gap-2 mb-3 flex-wrap">
 <span class="text-sm font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 uppercase">${p.type}</span>
 <span class="text-sm font-black text-slate-300 ">#${p.number}</span>
            ${nonLifecycle.slice(0, 2).map(l =>
 `<span class="text-sm font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">${escapeHtml(l.name)}</span>`
            ).join('')}
        </div>
 <p class="text-sm font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">${escapeHtml(p.title)}</p>
 <div class="flex items-center gap-3 mt-3 text-sm text-slate-400 font-bold">
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
