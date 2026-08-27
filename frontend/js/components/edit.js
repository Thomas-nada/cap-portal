const CATEGORIES = [
    { id: 'Procedural',   label: 'Procedural',   desc: 'Changes a governance procedure or process step.', consultation: '60 days' },
    { id: 'Substantive',  label: 'Substantive',  desc: 'Alters foundational values of the Constitution.', consultation: '60 days' },
    { id: 'Technical',    label: 'Technical',    desc: 'Updates technical/economic validation scripts and guardrail parameters.', consultation: 'Variable' },
    { id: 'Interpretive', label: 'Interpretive', desc: 'Clarifies existing language without changing intent.', consultation: '30 days' },
    { id: 'Editorial',    label: 'Editorial',    desc: 'Cosmetic fixes: typos, formatting, grammar.', consultation: '14 days' },
    { id: 'Other',        label: 'Other',        desc: "Doesn't fit other categories. Editors will assess.", consultation: '30 days' },
];

export function renderEdit(state) {
    const p = state.currentProposal;
    if (!p) return '';

    const isCIS = (p.labels || []).some(l => l.name === 'CIS');
    const type  = isCIS ? 'CIS' : 'CAP';

    const s = p.structured || {};
    const getSection = (key) => {
        if (s[key] !== undefined) return s[key] || '';
        // Legacy markdown fallback
        const normalised = (p.body || '').replace(/\r\n/g, '\n');
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`## ${escaped}\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
        const match = normalised.match(regex);
        return match ? match[1].trim() : '';
    };

    const currentCatLabel = (p.labels || []).find(l => CATEGORIES.some(c => c.id === l.name))?.name || '';

    return `
 <div class="max-w-4xl mx-auto pb-20 text-left fade-in">
 <header class="mb-16">
 <button onclick="window.setView('detail')" class="group flex items-center gap-2 text-on-surface-variant hover:text-brand-primary transition-colors mb-6 font-bold uppercase text-sm tracking-widest">
 <i data-lucide="arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition-transform"></i>
                Discard Changes
            </button>
 <div class="flex items-center gap-4 mb-4">
 <div class="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center shadow-lg text-white">
 <i data-lucide="edit-3" class="w-6 h-6"></i>
                </div>
 <h1 class="text-3xl sm:text-4xl font-black italic tracking-tighter text-on-surface uppercase leading-none">Edit</h1>
            </div>
 <p class="text-on-surface-variant text-xl font-medium">Modifying <span class="text-brand-primary font-bold">${type} #${p.number}</span>.</p>
        </header>

 <form id="edit-form" onsubmit="window.handleEdit(event)" class="space-y-12">

            <!-- Core Meta -->
 <div class="bg-white/80 p-10 sm:p-14 rounded-[4rem] border border-slate-100 shadow-sm space-y-10">
 <div class="space-y-3">
 <label class="text-sm font-black uppercase tracking-[0.2em] text-blue-600 ml-4">Title</label>
                    <input name="title" required value="${escapeHtml(p.title)}"
 class="w-full bg-slate-50 p-6 rounded-3xl text-2xl font-black outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 ">
                </div>

 <div class="space-y-6">
 <label class="text-sm font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Category</label>
 <div class="relative">
                        <select id="category-select" name="category" required
                            onchange="var o=this.options[this.selectedIndex]; document.getElementById('cat-desc').innerHTML=o.dataset.desc+'<span class=&quot;block mt-2 font-black not-italic text-blue-600&quot;>Recommended: '+o.dataset.consultation+'</span>';"
 class="w-full bg-slate-50 p-6 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-blue-600 appearance-none text-slate-900 cursor-pointer">
                            ${CATEGORIES.map(c => `<option value="${c.id}" data-desc="${escapeHtml(c.desc)}" data-consultation="${c.consultation}" ${currentCatLabel === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
                        </select>
 <i data-lucide="chevron-down" class="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"></i>
                    </div>
 <div class="mx-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 ">
 <p id="cat-desc" class="text-sm font-medium text-slate-400 italic leading-relaxed">
 ${currentCatLabel ? (() => { const c = CATEGORIES.find(c => c.id === currentCatLabel); return c ? `${c.desc}<span class="block mt-2 font-black not-italic text-blue-600">Recommended: ${c.consultation}</span>` : ''; })() : 'Select a category to see its description.'}
                        </p>
                    </div>
                </div>

 <div class="space-y-3">
 <label class="text-sm font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Summary</label>
                    <textarea name="abstract" id="edit-abstract" required
 class="w-full bg-slate-50 p-6 rounded-3xl min-h-[120px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 resize-none">${escapeHtml(getSection('abstract'))}</textarea>
                </div>
            </div>

            <!-- Why? -->
 <div class="bg-white/80 p-10 sm:p-14 rounded-[4rem] border border-slate-100 shadow-sm space-y-12">
                ${isCIS ? `
 <div class="space-y-8">
 <div class="space-y-3">
 <label class="text-sm font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Problem</label>
                        <textarea name="motivation" id="edit-motivation" required
 class="w-full bg-slate-50 p-8 rounded-3xl min-h-[160px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 ">${escapeHtml(getSection('motivation'))}</textarea>
                    </div>
 <div class="space-y-3">
 <label class="text-sm font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Context</label>
                        <textarea name="analysis" id="edit-analysis"
 class="w-full bg-slate-50 p-8 rounded-3xl min-h-[160px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 ">${escapeHtml(getSection('analysis'))}</textarea>
                    </div>
 <div class="space-y-3">
 <label class="text-sm font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Impact</label>
                        <textarea name="impact" id="edit-impact"
 class="w-full bg-slate-50 p-8 rounded-3xl min-h-[160px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 ">${escapeHtml(getSection('impact'))}</textarea>
                    </div>
                </div>
                ` : `
 <div class="space-y-2">
 <h3 class="text-sm font-black uppercase tracking-[0.3em] text-blue-600 ml-4">Why?</h3>
 <div class="space-y-8 pt-2">
 <div class="space-y-3">
 <label class="text-sm font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Why is this change needed?</label>
                            <textarea name="motivation" id="edit-motivation" required
 class="w-full bg-slate-50 p-8 rounded-3xl min-h-[180px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 ">${escapeHtml(getSection('motivation'))}</textarea>
                        </div>
 <div class="space-y-3">
 <label class="text-sm font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Analysis &amp; Test</label>
                            <textarea name="analysis" id="edit-analysis"
 class="w-full bg-slate-50 p-8 rounded-3xl min-h-[200px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 ">${escapeHtml(getSection('analysis'))}</textarea>
                        </div>
                    </div>
                </div>
                `}

 <div class="pt-10 border-t border-slate-50 space-y-6">
 <div class="flex items-center gap-3">
 <i data-lucide="paperclip" class="w-4 h-4 text-blue-600"></i>
 <h3 class="text-sm font-black uppercase tracking-[0.4em] text-slate-400">Links and Files</h3>
                    </div>
 <div class="space-y-3">
                        <textarea name="specification_extra" id="edit-exhibits"
                            placeholder="Edit existing or add new URLs…"
 class="w-full bg-slate-50 p-6 rounded-3xl min-h-[120px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 text-slate-900 resize-none">${escapeHtml(getSection('exhibits'))}</textarea>
                    </div>
                </div>
            </div>

            <!-- Proposed Revisions (CAP only; existing revisions are editable in place) -->
            ${!isCIS && Array.isArray(s.revisions) && s.revisions.length ? `
 <div class="bg-white/80 p-10 sm:p-14 rounded-[4rem] border border-slate-100 shadow-sm space-y-8">
 <div class="flex items-center gap-3">
 <i data-lucide="git-compare" class="w-4 h-4 text-blue-600"></i>
 <h3 class="text-sm font-black uppercase tracking-[0.4em] text-slate-400">Proposed Revisions</h3>
                </div>
 <p class="text-sm text-slate-400 italic leading-relaxed -mt-2">Editing the Proposed text is always safe. Changing the Original or Insert-after text alters how the revision matches the current Constitution; the side-by-side diff only shows a change when the anchor still matches exactly.</p>
                ${s.revisions.map((r, i) => {
                    const isAddition = r.type === 'addition';
                    const sectionLabel = r.section ? escapeHtml(r.section) : `Revision ${i + 1}`;
                    return `
 <div class="rounded-3xl border border-slate-100 p-6 sm:p-8 space-y-6 bg-slate-50/40">
 <p class="text-xs font-black uppercase tracking-[0.2em] text-blue-600">${sectionLabel}${isAddition ? ' · Insertion' : ''}</p>
                    ${isAddition ? `
 <div class="space-y-2">
 <label class="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Insert after (anchor text in the current Constitution)</label>
 <textarea id="edit-rev-${i}-anchor" class="w-full bg-white p-5 rounded-2xl min-h-[100px] font-mono text-sm outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-700 resize-y">${escapeHtml(r.insert_after || '')}</textarea>
                    </div>` : `
 <div class="space-y-2">
 <label class="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Original (must match the current Constitution)</label>
 <textarea id="edit-rev-${i}-original" class="w-full bg-white p-5 rounded-2xl min-h-[100px] font-mono text-sm outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-700 resize-y">${escapeHtml(r.original || '')}</textarea>
                    </div>`}
 <div class="space-y-2">
 <label class="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Proposed</label>
 <textarea id="edit-rev-${i}-proposed" class="w-full bg-white p-5 rounded-2xl min-h-[120px] font-mono text-sm outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 resize-y">${escapeHtml(r.proposed || '')}</textarea>
                    </div>
                    </div>`;
                }).join('')}
            </div>` : ''}

            <!-- Verification -->
 <div class="bg-blue-50/50 p-10 sm:p-14 rounded-[4rem] border border-blue-100 space-y-8">
 <h3 class="text-sm font-black uppercase tracking-[0.4em] text-blue-600 ml-4 mb-4">Governance Verification</h3>
 <label class="flex items-start gap-4 cursor-pointer group">
 <div class="relative flex items-center justify-center mt-1">
 <input type="checkbox" required class="peer appearance-none w-6 h-6 border-2 border-blue-200 rounded-lg checked:bg-blue-600 transition-all">
 <i data-lucide="check" class="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
                    </div>
 <span class="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors leading-relaxed">
                        I have reviewed the changes and confirm I wish to make these edits.
                    </span>
                </label>
            </div>

 <div class="flex flex-col sm:flex-row gap-6">
                <button type="button" onclick="window.setView('detail')"
 class="flex-1 bg-white/80 text-slate-500 p-8 rounded-[3rem] text-xl font-black border border-slate-200 hover:bg-slate-50 transition-all">
                    Cancel
                </button>
                <button type="button" onclick="window.previewEdit()"
 class="flex-1 group bg-white/80 text-slate-700 p-8 rounded-[3rem] text-xl font-black border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-3">
 <i data-lucide="eye" class="w-5 h-5 text-blue-600"></i> Preview
                </button>
                <button type="submit" ${state.loading?.submitting ? 'disabled' : ''}
 class="flex-[2] group bg-blue-600 hover:bg-blue-700 text-white p-8 rounded-[3rem] text-2xl font-black shadow-2xl hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50">
                    ${state.loading?.submitting ? 'Saving…' : 'Update Record'}
                </button>
            </div>
        </form>
    </div>`;
}

function escapeHtml(str) {
    // Quotes escaped too, so the title value="…" attribute is safe. Inside a
    // <textarea>, entities decode back to the original text and round-trip
    // through .value unchanged, so this does not alter saved revision content.
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
