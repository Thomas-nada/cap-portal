import { renderSingleView, initConstitutionSelection, CONSTITUTION_SECTIONS } from './constitution.js';

export function renderWizard(state) {
    if (state.wizardSubmitted) return renderSuccess(state.wizardSubmitted);
    const step = state.wizardStep || 1;
    // Default type to CAP so a radio shows selected on entry; user choices override.
    const wizard = {
        type: 'CAP', category: '', title: '', abstract: '',
        motivation: '', analysis: '', impact: '', selectedText: [],
        revisions: {}, exhibits: '', coAuthors: [],
        ...(state.wizardData || {}),
    };

    return `
 <div class="max-w-5xl mx-auto pb-28 fade-in text-left">
 <header class="mb-12">
 <h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-on-surface leading-none">New proposal</h1>
 <p class="text-on-surface-variant text-lg font-medium mt-3">A guided, step-by-step process to create a Constitutional Amendment Proposal</p>
        </header>

        <!-- Progress -->
 <div class="bg-white/80 rounded-[3rem] border border-slate-100 shadow-sm p-4 sm:p-8 mb-12">
 <div class="flex items-center justify-between mb-6">
                ${[1,2,3,4,5].map(i => {
                    const skipped = isStepSkipped(i, wizard);
                    const connMuted = wizard.type === 'CIS' && (i === 1 || i === 2 || i === 3);
                    return `
 <div class="flex flex-col items-center gap-2 flex-1">
 <div class="w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                            skipped ? 'bg-slate-100 text-slate-300' :
                            i < step ? 'bg-green-500 text-white' :
                            i === step ? 'bg-blue-600 text-white scale-110' :
                            'bg-slate-200 text-slate-400'
                        }">
 ${skipped ? '<i data-lucide="minus" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>' : i < step ? '<i data-lucide="check" class="w-4 h-4 sm:w-5 sm:h-5"></i>' : i}
                        </div>
 <span class="text-sm font-black uppercase tracking-widest ${skipped ? 'text-slate-200 ' : i === step ? 'text-blue-600' : 'text-slate-400'} hidden sm:block">
                            ${['Type','Select','Propose','Explain','Review'][i-1]}
                        </span>
                    </div>
 ${i < 5 ? `<div class="h-0.5 flex-1 ${connMuted ? 'bg-slate-100 ' : i < step ? 'bg-green-500' : 'bg-slate-200 '} mx-1 sm:mx-2"></div>` : ''}
                    `;
                }).join('')}
            </div>
        </div>

        ${renderStep(step, wizard, state)}

        ${state.wizardError ? `
 <div class="mt-8 flex items-center gap-3 px-6 py-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 ">
 <i data-lucide="alert-triangle" class="w-5 h-5 flex-shrink-0"></i>
 <span class="text-sm font-bold">${escapeHtml(state.wizardError)}</span>
        </div>` : ''}

    </div>
    ${renderWizardBar(step, wizard, state)}`;
}

// The persistent, always-visible navigation bar, fixed to the bottom of the
// screen on every step so Back/Next stay reachable no matter how far you scroll.
//   left  — Back (step > 1) or Discard (step 1)
//   right — Next, or Submit on the final step
// On the CAP "Select text" step it also shows the selection status + Add more,
// and clicking the count opens a panel listing every selection for review.
function renderWizardBar(step, wizard, state) {
    const isSelect = step === 2 && wizard.type !== 'CIS';
    const isLast = step === 5;
    const n = (wizard.selectedText || []).length;
    const hasSel = n > 0;
    const open = isSelect && hasSel && state.wizardSelPanelOpen;
    const submitting = state.loading?.submitting;

    const leftBtn = step > 1
        ? `<button onclick="window.wizardPrevStep()" class="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white/85 hover:bg-white/10 transition-colors"><i data-lucide="arrow-left" class="w-4 h-4"></i> Back</button>`
        : `<button onclick="window.wizardExit()" class="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-red-300 hover:bg-white/10 transition-colors"><i data-lucide="x" class="w-4 h-4"></i> Discard</button>`;

    let rightBtn;
    if (isLast) {
        rightBtn = `<button onclick="window.wizardSubmit()" ${submitting ? 'disabled' : ''}
 class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            ${submitting
                ? '<span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span> Submitting…'
                : '<i data-lucide="send" class="w-4 h-4"></i> Submit Proposal'}
        </button>`;
    } else if (isSelect) {
        rightBtn = `<button onclick="window.wizardNextStep()" ${hasSel ? '' : 'disabled'}
 class="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${hasSel ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}">
            Next step <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </button>`;
    } else {
        rightBtn = `<button onclick="window.wizardNextStep()"
 class="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black uppercase tracking-widest transition-all">
            Next <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </button>`;
    }

    const center = isSelect ? `
 <div class="flex items-center gap-2 min-w-0 flex-1 justify-center">
            ${hasSel
                ? `<button onclick="window.toggleWizardSelPanel()" title="${open ? 'Hide' : 'Show'} selections"
 class="flex items-center gap-2 min-w-0 rounded-xl px-2 py-1 hover:bg-white/10 transition-colors">
 <span class="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white"><i data-lucide="check" class="w-3.5 h-3.5"></i></span>
 <span class="text-white font-bold text-sm truncate">${n} passage${n === 1 ? '' : 's'} selected</span>
 <i data-lucide="${open ? 'chevron-down' : 'chevron-up'}" class="w-4 h-4 text-white/60 flex-shrink-0"></i>
                   </button>
                   <button onclick="document.getElementById('constitution-col')?.scrollIntoView({behavior:'smooth',block:'start'})"
 class="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors">+ Add more</button>`
                : `<span class="text-white/80 font-medium text-sm truncate text-center">Highlight text in the Constitution below, then choose Replace or Add After</span>`}
        </div>` : `<div class="flex-1"></div>`;

    const panel = open ? `
 <div class="max-w-5xl mx-auto px-4 sm:px-6 pt-4 max-h-[45vh] overflow-y-auto">
 <div class="space-y-2 pb-1">
            ${(wizard.selectedText || []).map((sel, idx) => `
 <div class="flex items-start gap-3 p-3 rounded-xl bg-white/10 border border-white/10">
 <span class="flex-shrink-0 text-sm font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${sel.kind === 'add_after' ? 'bg-cyan-500/25 text-cyan-200' : 'bg-white/15 text-white/70'}">${sel.kind === 'add_after' ? 'Add After' : 'Replace'}</span>
 <p class="flex-1 min-w-0 text-sm text-white/85 italic leading-snug line-clamp-2">"${escapeHtml(sel.text)}"</p>
                <button onclick="window.removeWizardSelection(${idx})" title="Remove selection"
 class="flex-shrink-0 text-red-300 hover:text-red-200 hover:bg-white/10 p-1.5 rounded-lg transition-all">
 <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            `).join('')}
        </div>
    </div>` : '';

    return `
 <div class="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
        ${panel}
 <div class="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            ${leftBtn}
            ${center}
            ${rightBtn}
        </div>
    </div>`;
}

function renderSuccess(number) {
    return `
 <div class="max-w-2xl mx-auto py-12 fade-in text-center">
 <div class="bg-white/90 rounded-[3rem] border border-slate-100 shadow-sm p-10 sm:p-16">
 <div class="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
 <i data-lucide="check" class="w-10 h-10 text-white"></i>
            </div>
 <h2 class="text-3xl font-black tracking-tight text-slate-900 mb-3">Proposal submitted</h2>
 <p class="text-slate-500 mb-10">Your proposal is now live in the registry and open for consultation.</p>
 <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onclick="window.wizardViewSubmitted(${number})"
 class="w-full sm:w-auto px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors flex items-center justify-center gap-2">
 <i data-lucide="file-text" class="w-4 h-4"></i> View your proposal
                </button>
                <button onclick="window.wizardCreateAnother()"
 class="w-full sm:w-auto px-8 py-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold hover:border-slate-400 transition-colors">
                    Create another
                </button>
            </div>
        </div>
    </div>`;
}

function renderStep(step, wizard, state) {
    switch (step) {
        case 1: return renderStep1(wizard);
        case 2: return wizard.type === 'CIS' ? renderStep4(wizard) : renderStep2(wizard, state);
        case 3: return wizard.type === 'CIS' ? renderStep4(wizard) : renderStep3(wizard);
        case 4: return renderStep4(wizard);
        case 5: return renderStep5(wizard);
        default: return '';
    }
}

const CATEGORIES = [
    { id: 'Procedural',   label: 'Procedural',   desc: 'Changes a governance procedure or process step.', days: 60 },
    { id: 'Substantive',  label: 'Substantive',  desc: 'Alters foundational values of the Constitution.', days: 60 },
    { id: 'Technical',    label: 'Technical',    desc: 'Updates technical/economic validation scripts and guardrail parameters.', days: 90, required: true },
    { id: 'Interpretive', label: 'Interpretive', desc: 'Clarifies existing language without changing intent.', days: 30 },
    { id: 'Editorial',    label: 'Editorial',    desc: 'Cosmetic fixes: typos, formatting, grammar. No substantive change.', days: 14 },
    { id: 'Other',        label: 'Other',        desc: 'Doesn\'t fit other categories. Editors will assess.', days: 30 },
];

function renderStep1(wizard) {
    return `
 <div class="bg-white/80 rounded-[3rem] border border-slate-100 shadow-sm p-6 sm:p-12">
 <h2 class="text-2xl font-black tracking-tight text-slate-900 mb-8">Step 1: Choose type</h2>

 <div class="mb-12">
 <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 block">Proposal type</label>
 <div class="space-y-3">
                ${[
                    { id: 'CAP', name: 'Constitutional Amendment Proposal', desc: 'Proposes specific changes to the Constitution text.' },
                    { id: 'CIS', name: 'Constitutional Issue Statement', desc: 'Identifies a constitutional problem without proposing specific changes.' },
                ].map(t => `
                <button onclick="window.updateWizard({type:'${t.id}'}); window.updateUI(true);"
 class="w-full p-5 rounded-2xl border-2 text-left transition-all flex items-start gap-4 ${wizard.type === t.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}">
 <span class="mt-1 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${wizard.type === t.id ? 'border-blue-600' : 'border-slate-300'}">
                        ${wizard.type === t.id ? '<span class="w-2.5 h-2.5 rounded-full bg-blue-600 block"></span>' : ''}
                    </span>
                    <span>
 <span class="block font-bold text-slate-900">${t.name} <span class="text-slate-400 font-medium">(${t.id})</span></span>
 <span class="block text-sm text-slate-500 mt-0.5">${t.desc}</span>
                    </span>
                </button>
                `).join('')}
            </div>
        </div>

        <div>
 <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 block">Category</label>
 <div class="grid grid-cols-1 gap-4">
                ${CATEGORIES.map(cat => `
                <button onclick="window.updateWizard({category:'${cat.id}'}); window.updateUI(true);"
 class="p-6 rounded-2xl border-2 transition-all text-left ${wizard.category === cat.id ? 'border-blue-600 bg-blue-50 ' : 'border-slate-200 hover:border-blue-300'}">
 <div class="flex items-start gap-4">
 <div class="w-10 h-10 rounded-xl ${wizard.category === cat.id ? 'bg-blue-600' : 'bg-slate-200 '} flex items-center justify-center flex-shrink-0">
 <i data-lucide="check" class="w-5 h-5 ${wizard.category === cat.id ? 'text-white' : 'text-slate-400'}"></i>
                        </div>
 <div class="flex-1">
 <h3 class="font-black text-lg text-slate-900 mb-1">${cat.label}</h3>
 <p class="text-sm text-slate-600 mb-1">${cat.desc}</p>
 ${wizard.type !== 'CIS' ? `<p class="text-sm font-black ${cat.required ? 'text-red-600' : 'text-blue-600'}">${cat.required ? 'Required' : 'Recommended'} consultation: ${cat.days} days</p>` : ''}
                        </div>
                    </div>
                </button>
                `).join('')}
            </div>
        </div>

 <div class="mt-12">
 <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 block">Title</label>
            <input type="text" value="${escapeHtml(wizard.title || '')}"
                oninput="state.wizardData.title = this.value; window._cc(this, 'cc-title')"
                placeholder="Give your ${wizard.type} a clear, descriptive title..." maxlength="200"
 class="w-full p-6 rounded-2xl border-2 border-slate-200 bg-white/80 text-slate-900 font-bold placeholder:font-normal text-xl focus:border-blue-600 outline-none transition-all">
            ${charCounter('cc-title', wizard.title, 200)}
        </div>
    </div>`;
}

function renderStep2(wizard, state) {
    // Enable the constitution text-selection popup inside this embedded reader.
    initConstitutionSelection();

    // The reader needs the current constitution content. Load it on demand.
    const cur = (state.constitutionVersions || []).find(v => v.name === state.constitutionCurrentVersion)
              || (state.constitutionVersions || [])[0];
    const contentReady = cur && cur.content;
    if (!contentReady) {
        window.ensureConstitutionForWizard?.();
    }

    const selected = wizard.selectedText || [];

    return `
 <div class="bg-white/80 rounded-[3rem] border border-slate-100 shadow-sm p-6 sm:p-12">
 <h2 class="text-2xl font-black tracking-tight text-slate-900 mb-4">Step 2: Select text you propose to change</h2>

 <div class="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-8">
 <div class="flex items-start gap-3">
 <i data-lucide="mouse-pointer-2" class="w-5 h-5 text-blue-600 mt-1 flex-shrink-0"></i>
                <div>
 <p class="font-bold text-slate-900 mb-2">Highlight the exact text you want to change in the Constitution below.</p>
 <p class="text-sm text-slate-600">When you release, choose <span class="font-black">Replace</span> to swap the wording, or <span class="font-black">Add After</span> to insert new text after it. Repeat to add more selections.</p>
                </div>
            </div>
        </div>

        ${selected.length > 0 ? `
 <div class="space-y-3 mb-8">
 <label class="text-sm font-black text-slate-400 uppercase tracking-widest block">Selected (${selected.length})</label>
            ${selected.map((sel, idx) => `
 <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 ">
 <div class="flex items-start justify-between gap-4 mb-2">
 <div class="flex items-center gap-2">
 <span class="text-sm font-black px-3 py-1 bg-blue-100 text-blue-600 rounded-full uppercase tracking-wider">Selection ${idx+1}</span>
                        ${sel.kind === 'add_after'
 ? `<span class="text-sm font-black px-3 py-1 bg-cyan-100 text-cyan-600 rounded-full uppercase tracking-wider">Add After</span>`
 : `<span class="text-sm font-black px-3 py-1 bg-slate-100 text-slate-500 rounded-full uppercase tracking-wider">Replace</span>`}
                    </div>
 <button onclick="window.removeWizardSelection(${idx})" class="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all">
 <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
 <p class="text-sm text-slate-600 italic">"${escapeHtml(sel.text)}"</p>
            </div>
            `).join('')}
        </div>
        ` : ''}

        ${!contentReady ? `
 <div class="flex items-center justify-center py-24">
 <div class="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        ` : `
        <!-- Mobile fallback: "Jump to" chips above the reader -->
 <div class="mb-4 flex flex-wrap items-center gap-2 lg:hidden">
 <span class="text-sm font-black uppercase tracking-widest text-slate-400 mr-1">Jump to</span>
            ${CONSTITUTION_SECTIONS.map(s => `
 <a href="#${s.id}" class="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all">${s.label}</a>
            `).join('')}
        </div>
        <!-- Reader flows with the page scroll; index floats alongside it -->
 <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_180px] lg:gap-6 lg:items-start">
 <div id="constitution-col" class="rounded-[2rem] border border-slate-100 bg-white">
                ${renderSingleView(cur, true)}
            </div>
 <aside class="hidden lg:block sticky top-40">
 <p class="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">Jump to</p>
 <nav class="flex flex-col gap-1">
                    ${CONSTITUTION_SECTIONS.map(s => `
 <a href="#${s.id}" class="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-blue-700 transition-all">${s.label}</a>
                    `).join('')}
                </nav>
            </aside>
        </div>
        `}
    </div>`;
}

function renderStep3(wizard) {
    if (wizard.type === 'CIS') return renderStep4(wizard);
    return `
 <div class="bg-white/80 rounded-[3rem] border border-slate-100 shadow-sm p-6 sm:p-12">
 <h2 class="text-2xl font-black tracking-tight text-slate-900 mb-4">Step 3: Propose changes</h2>
 <p class="text-slate-500 mb-8">Write your proposed text for each selection.</p>
        ${wizard.selectedText?.length > 0 ? `
 <div class="space-y-8">
            ${wizard.selectedText.map((sel, idx) => sel.kind === 'add_after' ? `
 <div class="p-8 rounded-2xl bg-slate-50 border border-cyan-200 ">
 <div class="mb-4">
 <label class="text-sm font-black uppercase tracking-widest text-cyan-500 mb-2 block">Insert After:</label>
 <div class="p-4 bg-cyan-50 rounded-xl border-l-4 border-cyan-400">
 <p class="text-sm text-slate-600 italic">"${escapeHtml(sel.text)}"</p>
                    </div>
                </div>
                <div>
 <label class="text-sm font-black uppercase tracking-widest text-slate-400 mb-2 block">New Text to Add:</label>
                    <textarea oninput="(state.wizardData.revisions = state.wizardData.revisions || {})[${idx}] = this.value; window._cc(this, 'cc-rev-${idx}')" maxlength="20000"
                        placeholder="Write the new text to insert after the selected passage..."
 class="w-full p-4 rounded-xl border-2 border-cyan-300 bg-white/80 text-slate-900 focus:border-cyan-500 outline-none transition-all min-h-32 font-mono text-sm"
                    >${escapeHtml(wizard.revisions?.[idx] || '')}</textarea>
                    ${charCounter(`cc-rev-${idx}`, wizard.revisions?.[idx], 20000)}
                </div>
            </div>
            ` : `
 <div class="p-8 rounded-2xl bg-slate-50 border border-slate-200 ">
 <div class="mb-4">
 <label class="text-sm font-black uppercase tracking-widest text-slate-400 mb-2 block">Original:</label>
 <div class="p-4 bg-red-50 rounded-xl border-l-4 border-red-500">
 <p class="text-sm text-slate-600 italic">"${escapeHtml(sel.text)}"</p>
                    </div>
                </div>
                <div>
 <label class="text-sm font-black uppercase tracking-widest text-slate-400 mb-2 block">Proposed:</label>
                    <textarea oninput="(state.wizardData.revisions = state.wizardData.revisions || {})[${idx}] = this.value; window._cc(this, 'cc-rev-${idx}')" maxlength="20000"
                        placeholder="Write your proposed replacement text..."
 class="w-full p-4 rounded-xl border-2 border-green-300 bg-green-50 text-slate-900 focus:border-green-500 outline-none transition-all min-h-32 font-mono text-sm"
                    >${escapeHtml(wizard.revisions?.[idx] || '')}</textarea>
                    ${charCounter(`cc-rev-${idx}`, wizard.revisions?.[idx], 20000)}
                </div>
            </div>
            `).join('')}
        </div>
        ` : `
 <div class="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl">
 <p class="text-slate-400 font-bold">No text selections — go back to Step 2</p>
        </div>
        `}
    </div>`;
}

function renderStep4(wizard) {
    const stepNum = wizard.type === 'CIS' ? '2' : '4';
    return `
 <div class="bg-white/80 rounded-[3rem] border border-slate-100 shadow-sm p-6 sm:p-12">
 <h2 class="text-2xl font-black tracking-tight text-slate-900 mb-4">Step ${stepNum}: Explain</h2>
 <p class="text-slate-500 mb-8">Provide context and reasoning.</p>
 <div class="space-y-8">
            <div>
 <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-1 block">Summary</label>
 <p class="text-sm text-slate-400 mb-3">A short, plain-language summary of the core idea.</p>
                <textarea oninput="state.wizardData.abstract = this.value; window._cc(this, 'cc-abstract')" maxlength="20000"
                    placeholder="Summarize the core idea..."
 class="w-full p-6 rounded-2xl border-2 border-slate-200 bg-white/80 text-slate-900 focus:border-blue-600 outline-none transition-all min-h-32"
                >${escapeHtml(wizard.abstract || '')}</textarea>
                    ${charCounter('cc-abstract', wizard.abstract, 20000)}
            </div>
            ${wizard.type === 'CAP' ? `
 <div class="space-y-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 ">
                <div>
 <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-1 block">Why is this change needed?</label>
 <p class="text-sm text-slate-400 mb-3">Explain the problem this solves and why the Constitution should change.</p>
                    <textarea oninput="state.wizardData.motivation = this.value; window._cc(this, 'cc-motivation')" maxlength="20000"
                        placeholder="Explain why the constitution should be changed..."
 class="w-full p-6 rounded-2xl border-2 border-slate-200 bg-white/80 text-slate-900 focus:border-blue-600 outline-none transition-all min-h-40"
                    >${escapeHtml(wizard.motivation || '')}</textarea>
                    ${charCounter('cc-motivation', wizard.motivation, 20000)}
                </div>
                <div>
 <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-1 block">Analysis &amp; Test</label>
 <p class="text-sm text-slate-400 mb-3">Describe the expected impact and consequences, and how you'll know the change worked (measurable success criteria).</p>
                    <textarea oninput="state.wizardData.analysis = this.value; window._cc(this, 'cc-analysis')" maxlength="20000"
                        placeholder="Describe expected impact, consequences, and measurable success criteria..."
 class="w-full p-6 rounded-2xl border-2 border-slate-200 bg-white/80 text-slate-900 focus:border-blue-600 outline-none transition-all min-h-48"
                    >${escapeHtml(wizard.analysis || '')}</textarea>
                    ${charCounter('cc-analysis', wizard.analysis, 20000)}
                </div>
            </div>
            ` : `
 <div class="space-y-6">
                <div>
 <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 block">Problem</label>
                    <textarea oninput="state.wizardData.motivation = this.value; window._cc(this, 'cc-motivation')" maxlength="20000"
                        placeholder="Describe the constitutional issue..."
 class="w-full p-6 rounded-2xl border-2 border-slate-200 bg-white/80 text-slate-900 focus:border-blue-600 outline-none transition-all min-h-36"
                    >${escapeHtml(wizard.motivation || '')}</textarea>
                    ${charCounter('cc-motivation', wizard.motivation, 20000)}
                </div>
                <div>
 <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 block">Context <span class="font-normal normal-case opacity-60">(optional)</span></label>
                    <textarea oninput="state.wizardData.analysis = this.value; window._cc(this, 'cc-analysis')" maxlength="20000"
                        placeholder="Background and context..."
 class="w-full p-6 rounded-2xl border-2 border-slate-200 bg-white/80 text-slate-900 focus:border-blue-600 outline-none transition-all min-h-36"
                    >${escapeHtml(wizard.analysis || '')}</textarea>
                    ${charCounter('cc-analysis', wizard.analysis, 20000)}
                </div>
                <div>
 <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 block">Impact <span class="font-normal normal-case opacity-60">(optional)</span></label>
                    <textarea oninput="state.wizardData.impact = this.value; window._cc(this, 'cc-impact')" maxlength="20000"
                        placeholder="Consequences if unaddressed..."
 class="w-full p-6 rounded-2xl border-2 border-slate-200 bg-white/80 text-slate-900 focus:border-blue-600 outline-none transition-all min-h-36"
                    >${escapeHtml(wizard.impact || '')}</textarea>
                    ${charCounter('cc-impact', wizard.impact, 20000)}
                </div>
            </div>
            `}
            <div>
 <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-3 block">Links and Files (Optional)</label>
                <textarea oninput="state.wizardData.exhibits = this.value; window._cc(this, 'cc-exhibits')" maxlength="20000"
                    placeholder="- Link 1&#10;- Link 2"
 class="w-full p-6 rounded-2xl border-2 border-slate-200 bg-white/80 text-slate-900 focus:border-blue-600 outline-none transition-all min-h-24"
                >${escapeHtml(wizard.exhibits || '')}</textarea>
                    ${charCounter('cc-exhibits', wizard.exhibits, 20000)}
            </div>
        </div>
    </div>`;
}

function renderStep5(wizard) {
    const stepNum = wizard.type === 'CIS' ? '3' : '5';
    return `
 <div class="bg-white/80 rounded-[3rem] border border-slate-100 shadow-sm p-6 sm:p-12">
 <h2 class="text-2xl font-black tracking-tight text-slate-900 mb-4">Step ${stepNum}: Review</h2>
 <p class="text-slate-500 mb-8">This is exactly how your proposal will look once published. Review it, then submit below.</p>
        ${window.wizardPreviewHtml ? window.wizardPreviewHtml() : ''}
    </div>`;
}

// The CAP-only Select (2) and Propose (3) screens are skipped for CIS proposals,
// which identify a problem without proposing specific text. Single source of truth
// for both the progress bar and Next/Back navigation.
export function isStepSkipped(step, wizard) {
    return wizard.type === 'CIS' && (step === 2 || step === 3);
}

// Validates the current wizard step before advancing. Returns an error message
// string to block "Next", or null when the step is complete. CIS-aware: CIS
// proposals skip the CAP-only Select (2) and Propose (3) screens.
export function validateStep(step, wizard) {
    const isCIS = wizard.type === 'CIS';
    // Map the linear step counter to the screen actually shown (mirrors renderStep).
    let screen;
    if (step === 1) screen = 'type';
    else if (step === 2) screen = isCIS ? 'explain' : 'select';
    else if (step === 3) screen = isCIS ? 'explain' : 'propose';
    else if (step === 4) screen = 'explain';
    else screen = 'other';

    switch (screen) {
        case 'type':
            if (!(wizard.title || '').trim()) return 'Enter a title to continue.';
            if (!wizard.category) return 'Choose a category to continue.';
            return null;
        case 'select':
            if (!(wizard.selectedText && wizard.selectedText.length))
                return 'Select at least one passage from the constitution before continuing.';
            return null;
        case 'propose': {
            const sels = wizard.selectedText || [];
            const revs = wizard.revisions || {};
            if (sels.some((_, idx) => !(revs[idx] || '').trim()))
                return 'Write proposed text for every selection before continuing.';
            return null;
        }
        case 'explain':
            if (!(wizard.abstract || '').trim()) return 'Add a summary before continuing.';
            if (!(wizard.motivation || '').trim())
                return isCIS ? 'Describe the problem before continuing.'
                             : 'Explain why this change is needed before continuing.';
            if (!isCIS && !(wizard.analysis || '').trim())
                return 'Complete the Analysis & Test section before continuing.';
            return null;
        default:
            return null;
    }
}

export function buildMarkdown(wizard) {
    let md = `### Summary\n${wizard.abstract || 'Not provided'}\n\n`;
    if (wizard.type === 'CAP') {
        md += `### Why is this change needed?\n${wizard.motivation || 'Not provided'}\n\n`;
        md += `### Analysis & Test\n${wizard.analysis || 'Not provided'}\n\n`;
    } else {
        md += `### Problem\n${wizard.motivation || 'Not provided'}\n\n`;
        if (wizard.analysis) md += `### Context\n${wizard.analysis}\n\n`;
        if (wizard.impact) md += `### Impact\n${wizard.impact}\n\n`;
    }
    if (wizard.type === 'CAP' && wizard.selectedText?.length > 0) {
        md += `### Structured Revisions (Contextual)\n\n`;
        wizard.selectedText.forEach((sel, idx) => {
            md += `#### Revision #${idx+1}: ${sel.section || 'General'}\n`;
            md += `**Original Text:**\n> ${sel.text}\n\n`;
            md += `**Proposed Revision:**\n${wizard.revisions?.[idx] || 'Not provided'}\n\n`;
        });
    }
    md += `### Links and Files\n${wizard.exhibits || 'None provided.'}\n\n`;
    const cat = wizard.category;
    const dayMap = { Procedural: 60, Substantive: 60, Technical: 90, Interpretive: 30, Editorial: 14, Other: 30 };
    const days = dayMap[cat] || 30;
    md += `### Proposal Details\n- **License:** CC-BY-4.0\n- **Category:** ${cat || '—'}\n`;
    if (wizard.type === 'CAP') {
        const expiry = new Date(Date.now() + days * 86400000).toISOString();
        md += `- **Recommended Review Date:** ${new Date(expiry).toLocaleDateString()}\n\n`;
        md += `<!-- DELIBERATION_END: ${expiry} -->`;
    }
    return md;
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// "X / Y characters" line under a field. The X span is updated live by
// window._cc from the field's oninput; Y (the limit) is static.
function charCounter(id, value, max) {
    return `<p class="text-sm text-slate-400 text-right mt-1"><span id="${id}">${String(value || '').length.toLocaleString()}</span> / ${max.toLocaleString()} characters</p>`;
}
