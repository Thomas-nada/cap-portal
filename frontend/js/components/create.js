const CATEGORIES = [
    { id: 'Procedural',   label: 'Procedural',   desc: 'Changes a governance procedure or process step.', consultation: '60 days' },
    { id: 'Substantive',  label: 'Substantive',  desc: 'Alters foundational values of the Constitution.', consultation: '60 days' },
    { id: 'Technical',    label: 'Technical',    desc: 'Updates technical/economic validation scripts and guardrail parameters.', consultation: 'Variable' },
    { id: 'Interpretive', label: 'Interpretive', desc: 'Clarifies existing language without changing intent.', consultation: '30 days' },
    { id: 'Editorial',    label: 'Editorial',    desc: 'Cosmetic fixes: typos, formatting, grammar.', consultation: '14 days' },
    { id: 'Other',        label: 'Other',        desc: "Doesn't fit other categories. Editors will assess.", consultation: '30 days' },
];

export function renderCreate(state) {
    const isCIS = state.createType === 'CIS';
    const refs = state.selectedReferences || [];
    const draft = state.draftProposal || {};

    return `
    <div class="max-w-4xl mx-auto pb-20 text-left fade-in">
        <header class="mb-16">
            <div class="flex items-center gap-4 mb-4">
                <div class="w-12 h-12 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center shadow-lg text-white dark:text-slate-900">
                    <i data-lucide="${isCIS ? 'alert-octagon' : 'plus-square'}" class="w-6 h-6"></i>
                </div>
                <h1 class="text-6xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                    ${isCIS ? 'Flag Issue' : 'New Proposal'}
                </h1>
            </div>
            <p class="text-slate-500 text-xl font-medium">
                ${isCIS ? 'Identify a structural problem within the institutional layer.' : 'Draft a formal amendment for the Cardano Constitution.'}
            </p>
        </header>

        <!-- Type Toggle -->
        <div class="flex p-2 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm mb-12 max-w-md">
            <button onclick="window.setCreateType('CAP')"
                class="flex-1 py-4 rounded-[2.5rem] text-sm font-black uppercase tracking-widest transition-all ${!isCIS ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}">
                CAP
            </button>
            <button onclick="window.setCreateType('CIS')"
                class="flex-1 py-4 rounded-[2.5rem] text-sm font-black uppercase tracking-widest transition-all ${isCIS ? 'bg-amber-500 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}">
                CIS
            </button>
        </div>

        <form id="create-form" onsubmit="window.handleForm(event)" class="space-y-12">

            <!-- Core Meta -->
            <div class="bg-white dark:bg-slate-900 p-10 sm:p-14 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-10">
                <div class="space-y-3">
                    <label class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 ml-4">Title</label>
                    <input name="title" id="create-title" required value="${escapeHtml(draft.title || '')}"
                        oninput="window.updateDraftField('title', this.value)"
                        placeholder="Name your governance record..."
                        class="w-full bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl text-2xl font-black outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 dark:text-white">
                </div>

                <div class="space-y-6">
                    <label class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Category</label>
                    <div class="relative">
                        <select id="category-select" name="category" required data-is-cis="${isCIS}"
                            onchange="window.updateDraftField('category', this.value); var o=this.options[this.selectedIndex]; var d=o.dataset.desc; if(this.dataset.isCis!=='true'){d+='<span class=&quot;block mt-2 font-black not-italic text-blue-600&quot;>Recommended: '+o.dataset.consultation+'</span>';} document.getElementById('cat-desc').innerHTML=d;"
                            class="w-full bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-blue-600 appearance-none text-slate-900 dark:text-white cursor-pointer">
                            <option value="" disabled ${!draft.category ? 'selected' : ''}>Select a category…</option>
                            ${CATEGORIES.map(c => `<option value="${c.id}" data-desc="${escapeHtml(c.desc)}" data-consultation="${c.consultation}" ${draft.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
                        </select>
                        <i data-lucide="chevron-down" class="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"></i>
                    </div>
                    <div class="mx-4 p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p id="cat-desc" class="text-xs font-medium text-slate-400 italic leading-relaxed">
                            ${draft.category ? (() => {
                                const c = CATEGORIES.find(c => c.id === draft.category);
                                return c ? (isCIS ? c.desc : `${c.desc}<span class="block mt-2 font-black not-italic text-blue-600">Recommended: ${c.consultation}</span>`) : 'Select a category to see its description.';
                            })() : 'Select a category to see its description.'}
                        </p>
                    </div>
                </div>

                <div class="space-y-3">
                    <label class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Summary</label>
                    <textarea name="abstract" id="create-abstract" required oninput="window.updateDraftField('abstract', this.value)"
                        placeholder="A high-level summary…"
                        class="w-full bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl min-h-[120px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 dark:text-white resize-none">${escapeHtml(draft.abstract || '')}</textarea>
                </div>
            </div>

            <!-- Constitution References -->
            <div class="space-y-6">
                <div class="flex items-center justify-between px-8">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-8 bg-blue-600 rounded-full"></div>
                        <h2 class="text-xs font-black uppercase tracking-[0.3em] text-slate-400">${isCIS ? 'Referenced Sections' : 'Contextual Revisions'}</h2>
                    </div>
                    <button type="button" onclick="window.setView('constitution')" class="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">
                        + Reference Constitution
                    </button>
                </div>

                ${refs.length === 0 ? `
                <div class="bg-white/50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 p-16 rounded-[4rem] text-center">
                    <p class="text-slate-400 font-bold text-sm italic">Highlight text in the Constitution to add a reference.</p>
                </div>
                ` : refs.map((ref, idx) => `
                <div class="bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8 relative group">
                    <button type="button" onclick="window.removeReference('${ref.id}')" class="absolute top-8 right-8 text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 p-2 rounded-full">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                    <div class="space-y-4">
                        <span class="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest">Source: ${escapeHtml(ref.section)}</span>
                        <div class="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl italic text-slate-500 text-lg leading-relaxed border border-slate-100 dark:border-slate-800">"${escapeHtml(ref.text)}"</div>
                    </div>
                    <div class="space-y-3">
                        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 ml-4">${isCIS ? 'Problem identification' : 'Proposed amendment'}</label>
                        <textarea name="ref-input-${ref.id}" id="ref-input-${ref.id}" required oninput="window.updateDraftField('ref-input-${ref.id}', this.value)"
                            class="w-full bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] min-h-[150px] font-medium text-lg outline-none border-2 border-blue-100 dark:border-blue-900/30 focus:border-blue-600 transition-all text-slate-900 dark:text-white shadow-inner">${escapeHtml(draft.revisions?.[ref.id] || '')}</textarea>
                    </div>
                </div>
                `).join('')}
            </div>

            <!-- Why / Motivation -->
            <div class="bg-white dark:bg-slate-900 p-10 sm:p-14 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-12">
                ${isCIS ? `
                <div class="space-y-8">
                    <div class="space-y-3">
                        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Problem</label>
                        <textarea name="motivation" id="create-motivation" required oninput="window.updateDraftField('motivation', this.value)"
                            placeholder="Describe the constitutional issue…"
                            class="w-full bg-slate-50 dark:bg-slate-950 p-8 rounded-3xl min-h-[160px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 dark:text-white">${escapeHtml(draft.motivation || '')}</textarea>
                    </div>
                    <div class="space-y-3">
                        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Context <span class="font-normal normal-case tracking-normal opacity-60">(optional)</span></label>
                        <textarea name="analysis" id="create-analysis" oninput="window.updateDraftField('analysis', this.value)"
                            placeholder="Background and context…"
                            class="w-full bg-slate-50 dark:bg-slate-950 p-8 rounded-3xl min-h-[160px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 dark:text-white">${escapeHtml(draft.analysis || '')}</textarea>
                    </div>
                    <div class="space-y-3">
                        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Impact <span class="font-normal normal-case tracking-normal opacity-60">(optional)</span></label>
                        <textarea name="impact" id="create-impact" oninput="window.updateDraftField('impact', this.value)"
                            placeholder="Consequences if unaddressed…"
                            class="w-full bg-slate-50 dark:bg-slate-950 p-8 rounded-3xl min-h-[160px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 dark:text-white">${escapeHtml(draft.impact || '')}</textarea>
                    </div>
                </div>
                ` : `
                <div class="space-y-2">
                    <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 ml-4">Why?</h3>
                    <div class="space-y-8 pt-2">
                        <div class="space-y-3">
                            <div class="flex items-baseline justify-between ml-4 mr-4">
                                <label class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Why is this change needed?</label>
                                <span id="motivation-word-count" class="text-[10px] font-black ${(() => { const w = draft.motivation ? draft.motivation.trim().split(/\s+/).filter(Boolean).length : 0; return w > 500 ? 'text-red-500' : w > 400 ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'; })()}">${draft.motivation ? draft.motivation.trim().split(/\s+/).filter(Boolean).length : 0} / 500 words</span>
                            </div>
                            <textarea name="motivation" id="create-motivation" required
                                oninput="window.updateDraftField('motivation', this.value); var w=this.value.trim()?this.value.trim().split(/\s+/).filter(Boolean).length:0; var el=document.getElementById('motivation-word-count'); if(el){el.textContent=w+' / 500 words'; el.className='text-[10px] font-black '+(w>500?'text-red-500':w>400?'text-amber-500':'text-slate-300 dark:text-slate-600');}"
                                placeholder="Explain why the constitution should be changed…"
                                class="w-full bg-slate-50 dark:bg-slate-950 p-8 rounded-3xl min-h-[180px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 dark:text-white">${escapeHtml(draft.motivation || '')}</textarea>
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Analysis &amp; Test</label>
                            <textarea name="analysis" id="create-analysis" required oninput="window.updateDraftField('analysis', this.value)"
                                placeholder="Describe expected impact and measurable success criteria…"
                                class="w-full bg-slate-50 dark:bg-slate-950 p-8 rounded-3xl min-h-[200px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 dark:text-white">${escapeHtml(draft.analysis || '')}</textarea>
                        </div>
                    </div>
                </div>
                `}

                <!-- Links -->
                <div class="pt-10 border-t border-slate-50 dark:border-slate-800 space-y-6">
                    <div class="flex items-center gap-3">
                        <i data-lucide="paperclip" class="w-4 h-4 text-blue-600"></i>
                        <h3 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Links & Files</h3>
                    </div>
                    <div class="space-y-3">
                        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 italic">External References &amp; Links</label>
                        <textarea name="specification_extra" id="create-exhibits" oninput="window.updateDraftField('exhibits', this.value)"
                            placeholder="Paste relevant URLs…"
                            class="w-full bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl min-h-[120px] font-medium text-lg outline-none border-2 border-transparent focus:border-blue-600 text-slate-900 dark:text-white resize-none">${escapeHtml(draft.exhibits || '')}</textarea>
                    </div>
                </div>
            </div>

            <!-- Acknowledgments -->
            <div class="bg-blue-50/50 dark:bg-blue-900/10 p-10 sm:p-14 rounded-[4rem] border border-blue-100 dark:border-blue-800/30 space-y-8">
                <h3 class="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 ml-4 mb-4">Governance Acknowledgments</h3>
                <div class="space-y-6">
                    <label class="flex items-start gap-4 cursor-pointer group">
                        <div class="relative flex items-center justify-center mt-1">
                            <input type="checkbox" required class="peer appearance-none w-6 h-6 border-2 border-blue-200 dark:border-blue-800 rounded-lg checked:bg-blue-600 transition-all">
                            <i data-lucide="check" class="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
                        </div>
                        <span class="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors leading-relaxed">
                            ${isCIS
                                ? 'I understand this issue statement will be publicly visible and open for community discussion.'
                                : 'I understand this submission includes a recommended public consultation period based on the category selected.'}
                        </span>
                    </label>
                    <label class="flex items-start gap-4 cursor-pointer group">
                        <div class="relative flex items-center justify-center mt-1">
                            <input type="checkbox" required class="peer appearance-none w-6 h-6 border-2 border-blue-200 dark:border-blue-800 rounded-lg checked:bg-blue-600 transition-all">
                            <i data-lucide="check" class="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
                        </div>
                        <span class="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors leading-relaxed">
                            I agree to license this document and all associated exhibits under <span class="text-blue-600 underline decoration-2 underline-offset-4">CC-BY-4.0</span>.
                        </span>
                    </label>
                </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-6">
                <button type="button" onclick="window.previewCreate()"
                    class="flex-1 group bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 p-8 rounded-[3rem] text-xl font-black border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-4">
                    <i data-lucide="eye" class="w-6 h-6 text-blue-600"></i> Preview
                </button>
                <button type="submit" ${state.loading?.submitting ? 'disabled' : ''}
                    class="flex-[2] group bg-slate-950 dark:bg-white text-white dark:text-slate-950 p-8 rounded-[3rem] text-2xl font-black shadow-2xl hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50">
                    ${state.loading?.submitting
                        ? `<div class="w-6 h-6 border-4 border-slate-400 border-t-white dark:border-slate-200 dark:border-t-slate-950 rounded-full animate-spin"></div> Submitting…`
                        : `${isCIS ? 'Flag Issue' : 'Submit Proposal'} <i data-lucide="send" class="w-6 h-6 group-hover:translate-x-2 transition-transform"></i>`
                    }
                </button>
            </div>
        </form>
    </div>`;
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
