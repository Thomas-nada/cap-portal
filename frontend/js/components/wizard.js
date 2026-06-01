export function renderWizard(state) {
    const step = state.wizardStep || 1;
    const wizard = state.wizardData || {
        type: 'CAP', category: '', title: '', abstract: '',
        motivation: '', analysis: '', impact: '', selectedText: [],
        revisions: {}, exhibits: '', coAuthors: []
    };

    return `
    <div class="max-w-5xl mx-auto pb-20 fade-in text-left">
        <header class="mb-12">
            <div class="flex items-center gap-4 mb-4">
                <div class="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg text-white">
                    <i data-lucide="wand-2" class="w-6 h-6"></i>
                </div>
                <div>
                    <h1 class="text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Amendment Wizard</h1>
                    <p class="text-slate-500 text-lg font-medium mt-2">Step-by-step CAP creation</p>
                </div>
            </div>
        </header>

        <!-- Progress -->
        <div class="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm p-8 mb-12">
            <div class="flex items-center justify-between mb-6">
                ${[1,2,3,4,5,6].map(i => {
                    const skipped = isStepSkipped(i, wizard);
                    const connMuted = wizard.type === 'CIS' && (i === 1 || i === 2 || i === 3);
                    return `
                    <div class="flex flex-col items-center gap-2 flex-1">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                            skipped ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-300' :
                            i < step ? 'bg-green-500 text-white' :
                            i === step ? 'bg-blue-600 text-white scale-110' :
                            'bg-slate-200 dark:bg-slate-800 text-slate-400'
                        }">
                            ${skipped ? '<i data-lucide="minus" class="w-4 h-4"></i>' : i < step ? '<i data-lucide="check" class="w-5 h-5"></i>' : i}
                        </div>
                        <span class="text-[9px] font-black uppercase tracking-widest ${skipped ? 'text-slate-200 dark:text-slate-700' : i === step ? 'text-blue-600' : 'text-slate-400'} hidden sm:block">
                            ${['Type','Select','Propose','Explain','Review','Submit'][i-1]}
                        </span>
                    </div>
                    ${i < 6 ? `<div class="h-0.5 flex-1 ${connMuted ? 'bg-slate-100 dark:bg-slate-800/40' : i < step ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-800'} mx-2"></div>` : ''}
                    `;
                }).join('')}
            </div>
        </div>

        ${renderStep(step, wizard, state)}

        ${state.wizardError ? `
        <div class="mt-8 flex items-center gap-3 px-6 py-4 rounded-2xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300">
            <i data-lucide="alert-triangle" class="w-5 h-5 flex-shrink-0"></i>
            <span class="text-sm font-bold">${escapeHtml(state.wizardError)}</span>
        </div>` : ''}

        <div class="flex items-center justify-between ${state.wizardError ? 'mt-6' : 'mt-12'}">
            ${step > 1 ? `
            <button onclick="window.wizardPrevStep()"
                class="px-8 py-4 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-sm uppercase tracking-widest hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-2">
                <i data-lucide="arrow-left" class="w-4 h-4"></i> Back
            </button>
            ` : '<div></div>'}
            ${step < 6 ? `
            <button onclick="window.wizardNextStep()"
                class="px-8 py-4 rounded-2xl bg-blue-600 text-white font-black text-sm uppercase tracking-widest hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-2 shadow-xl">
                Next <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
            ` : `
            <button onclick="window.wizardSubmit()"
                class="px-12 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black text-sm uppercase tracking-widest hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-3 shadow-xl">
                <i data-lucide="send" class="w-5 h-5"></i> Submit Proposal
            </button>
            `}
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
        case 6: return renderStep6(wizard);
        default: return '';
    }
}

const CATEGORIES = [
    { id: 'Procedural',   label: 'Procedural',   desc: 'Changes a governance procedure or process step.', days: 60 },
    { id: 'Substantive',  label: 'Substantive',  desc: 'Alters foundational values of the Constitution.', days: 60 },
    { id: 'Technical',    label: 'Technical',    desc: 'Updates technical/economic validation scripts and guardrail parameters.', days: 60 },
    { id: 'Interpretive', label: 'Interpretive', desc: 'Clarifies existing language without changing intent.', days: 30 },
    { id: 'Editorial',    label: 'Editorial',    desc: 'Cosmetic fixes: typos, formatting, grammar. No substantive change.', days: 14 },
    { id: 'Other',        label: 'Other',        desc: 'Doesn\'t fit other categories. Editors will assess.', days: 30 },
];

function renderStep1(wizard) {
    return `
    <div class="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm p-12">
        <h2 class="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-8">Step 1: Choose Type</h2>

        <div class="mb-12">
            <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 block">Proposal Type</label>
            <div class="flex p-2 bg-slate-100 dark:bg-slate-800 rounded-2xl max-w-md">
                <button onclick="window.updateWizard({type:'CAP'}); window.updateUI(true);"
                    class="flex-1 py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${wizard.type === 'CAP' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}">
                    CAP
                </button>
                <button onclick="window.updateWizard({type:'CIS'}); window.updateUI(true);"
                    class="flex-1 py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${wizard.type === 'CIS' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}">
                    CIS
                </button>
            </div>
            <p class="text-sm text-slate-500 mt-3">
                ${wizard.type === 'CAP' ?
                    '<strong>CAP:</strong> Proposes specific changes to the constitution text.' :
                    '<strong>CIS:</strong> Identifies a constitutional problem without proposing specific changes.'}
            </p>
        </div>

        <div>
            <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 block">Category</label>
            <div class="grid grid-cols-1 gap-4">
                ${CATEGORIES.map(cat => `
                <button onclick="window.updateWizard({category:'${cat.id}'}); window.updateUI(true);"
                    class="p-6 rounded-2xl border-2 transition-all text-left ${wizard.category === cat.id ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300'}">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-xl ${wizard.category === cat.id ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'} flex items-center justify-center flex-shrink-0">
                            <i data-lucide="check" class="w-5 h-5 ${wizard.category === cat.id ? 'text-white' : 'text-slate-400'}"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="font-black text-lg text-slate-900 dark:text-white mb-1">${cat.label}</h3>
                            <p class="text-sm text-slate-600 dark:text-slate-400 mb-1">${cat.desc}</p>
                            ${wizard.type !== 'CIS' ? `<p class="text-xs font-black text-blue-600">Recommended consultation: ${cat.days} days</p>` : ''}
                        </div>
                    </div>
                </button>
                `).join('')}
            </div>
        </div>

        <div class="mt-12">
            <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 block">Title</label>
            <input type="text" value="${escapeHtml(wizard.title || '')}"
                oninput="state.wizardData.title = this.value;"
                placeholder="Give your ${wizard.type} a clear, descriptive title..."
                class="w-full p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold text-xl focus:border-blue-600 outline-none transition-all">
        </div>
    </div>`;
}

function renderStep2(wizard, state) {
    return `
    <div class="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm p-12">
        <h2 class="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-4">Step 2: Select Text</h2>
        <p class="text-slate-500 mb-8">Choose the exact text from the constitution you want to change</p>

        <div class="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 mb-8">
            <div class="flex items-start gap-3">
                <i data-lucide="lightbulb" class="w-5 h-5 text-blue-600 mt-1 flex-shrink-0"></i>
                <div>
                    <p class="font-bold text-slate-900 dark:text-white mb-2">How to select text:</p>
                    <ol class="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-decimal list-inside">
                        <li>Click "Browse Constitution" below</li>
                        <li>Highlight the text you want to change</li>
                        <li>Click "+ CAP" in the popup that appears</li>
                        <li>Repeat to add more selections</li>
                    </ol>
                </div>
            </div>
        </div>

        ${wizard.selectedText?.length > 0 ? `
        <div class="space-y-4 mb-8">
            <label class="text-sm font-black text-slate-400 uppercase tracking-widest block">Selected (${wizard.selectedText.length})</label>
            ${wizard.selectedText.map((sel, idx) => `
            <div class="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div class="flex items-start justify-between gap-4 mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full uppercase tracking-wider">Selection ${idx+1}</span>
                        ${sel.kind === 'add_after'
                            ? `<span class="text-xs font-black px-3 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 rounded-full uppercase tracking-wider">Add After</span>`
                            : `<span class="text-xs font-black px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-full uppercase tracking-wider">Replace</span>`}
                    </div>
                    <button onclick="window.removeWizardSelection(${idx})" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-all">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
                <p class="text-sm text-slate-600 dark:text-slate-300 italic">"${escapeHtml(sel.text)}"</p>
            </div>
            `).join('')}
        </div>
        ` : `
        <div class="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl mb-8">
            <i data-lucide="mouse-pointer-click" class="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4"></i>
            <p class="text-slate-400 font-bold mb-4">No text selected yet</p>
        </div>
        `}

        <button onclick="window.openConstitutionForWizard()"
            class="w-full px-8 py-5 rounded-2xl bg-blue-600 text-white font-black uppercase text-sm tracking-widest hover:-translate-y-1 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3">
            <i data-lucide="book-open" class="w-5 h-5"></i>
            Browse Constitution
        </button>
    </div>`;
}

function renderStep3(wizard) {
    if (wizard.type === 'CIS') return renderStep4(wizard);
    return `
    <div class="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm p-12">
        <h2 class="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-4">Step 3: Propose Changes</h2>
        <p class="text-slate-500 mb-8">Write your proposed text for each selection</p>
        ${wizard.selectedText?.length > 0 ? `
        <div class="space-y-8">
            ${wizard.selectedText.map((sel, idx) => sel.kind === 'add_after' ? `
            <div class="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-cyan-200 dark:border-cyan-800/40">
                <div class="mb-4">
                    <label class="text-[10px] font-black uppercase tracking-widest text-cyan-500 mb-2 block">Insert After:</label>
                    <div class="p-4 bg-cyan-50 dark:bg-cyan-900/10 rounded-xl border-l-4 border-cyan-400">
                        <p class="text-sm text-slate-600 dark:text-slate-300 italic">"${escapeHtml(sel.text)}"</p>
                    </div>
                </div>
                <div>
                    <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">New Text to Add:</label>
                    <textarea oninput="(state.wizardData.revisions = state.wizardData.revisions || {})[${idx}] = this.value;"
                        placeholder="Write the new text to insert after the selected passage..."
                        class="w-full p-4 rounded-xl border-2 border-cyan-300 dark:border-cyan-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 outline-none transition-all min-h-32 font-mono text-sm"
                    >${escapeHtml(wizard.revisions?.[idx] || '')}</textarea>
                </div>
            </div>
            ` : `
            <div class="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div class="mb-4">
                    <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Original:</label>
                    <div class="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border-l-4 border-red-500">
                        <p class="text-sm text-slate-600 dark:text-slate-300 italic">"${escapeHtml(sel.text)}"</p>
                    </div>
                </div>
                <div>
                    <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Proposed:</label>
                    <textarea oninput="(state.wizardData.revisions = state.wizardData.revisions || {})[${idx}] = this.value;"
                        placeholder="Write your proposed replacement text..."
                        class="w-full p-4 rounded-xl border-2 border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/10 text-slate-900 dark:text-white focus:border-green-500 outline-none transition-all min-h-32 font-mono text-sm"
                    >${escapeHtml(wizard.revisions?.[idx] || '')}</textarea>
                </div>
            </div>
            `).join('')}
        </div>
        ` : `
        <div class="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <p class="text-slate-400 font-bold">No text selections — go back to Step 2</p>
        </div>
        `}
    </div>`;
}

function renderStep4(wizard) {
    const stepNum = wizard.type === 'CIS' ? '2' : '4';
    return `
    <div class="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm p-12">
        <h2 class="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-4">Step ${stepNum}: Explain</h2>
        <p class="text-slate-500 mb-8">Provide context and reasoning</p>
        <div class="space-y-8">
            <div>
                <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-3 block">Summary</label>
                <textarea oninput="state.wizardData.abstract = this.value;"
                    placeholder="Summarize the core idea..."
                    class="w-full p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-blue-600 outline-none transition-all min-h-32"
                >${escapeHtml(wizard.abstract || '')}</textarea>
            </div>
            ${wizard.type === 'CAP' ? `
            <div class="space-y-6 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h3 class="text-xs font-black uppercase tracking-widest text-blue-600">Why?</h3>
                <div>
                    <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 block">Why is this change needed?</label>
                    <textarea oninput="state.wizardData.motivation = this.value;"
                        placeholder="Explain why the constitution should be changed..."
                        class="w-full p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-blue-600 outline-none transition-all min-h-40"
                    >${escapeHtml(wizard.motivation || '')}</textarea>
                </div>
                <div>
                    <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 block">Analysis &amp; Test</label>
                    <textarea oninput="state.wizardData.analysis = this.value;"
                        placeholder="Describe expected impact, consequences, and measurable success criteria..."
                        class="w-full p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-blue-600 outline-none transition-all min-h-48"
                    >${escapeHtml(wizard.analysis || '')}</textarea>
                </div>
            </div>
            ` : `
            <div class="space-y-6">
                <div>
                    <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 block">Problem</label>
                    <textarea oninput="state.wizardData.motivation = this.value;"
                        placeholder="Describe the constitutional issue..."
                        class="w-full p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-blue-600 outline-none transition-all min-h-36"
                    >${escapeHtml(wizard.motivation || '')}</textarea>
                </div>
                <div>
                    <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 block">Context <span class="font-normal normal-case opacity-60">(optional)</span></label>
                    <textarea oninput="state.wizardData.analysis = this.value;"
                        placeholder="Background and context..."
                        class="w-full p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-blue-600 outline-none transition-all min-h-36"
                    >${escapeHtml(wizard.analysis || '')}</textarea>
                </div>
                <div>
                    <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 block">Impact <span class="font-normal normal-case opacity-60">(optional)</span></label>
                    <textarea oninput="state.wizardData.impact = this.value;"
                        placeholder="Consequences if unaddressed..."
                        class="w-full p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-blue-600 outline-none transition-all min-h-36"
                    >${escapeHtml(wizard.impact || '')}</textarea>
                </div>
            </div>
            `}
            <div>
                <label class="text-sm font-black text-slate-400 uppercase tracking-widest mb-3 block">Links and Files (Optional)</label>
                <textarea oninput="state.wizardData.exhibits = this.value;"
                    placeholder="- Link 1&#10;- Link 2"
                    class="w-full p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-blue-600 outline-none transition-all min-h-24"
                >${escapeHtml(wizard.exhibits || '')}</textarea>
            </div>
        </div>
    </div>`;
}

function renderStep5(wizard) {
    const stepNum = wizard.type === 'CIS' ? '3' : '5';
    return `
    <div class="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm p-12">
        <h2 class="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-4">Step ${stepNum}: Review</h2>
        <p class="text-slate-500 mb-8">Check everything before submitting</p>
        <div class="grid grid-cols-2 gap-6 mb-8">
            <div class="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <p class="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Type</p>
                <p class="text-xl font-black text-slate-900 dark:text-white">${wizard.type}</p>
            </div>
            <div class="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <p class="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Category</p>
                <p class="text-xl font-black text-slate-900 dark:text-white">${wizard.category || '—'}</p>
            </div>
        </div>
        <div class="mb-10">
            <p class="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Title</p>
            <p class="text-2xl font-black text-slate-900 dark:text-white">${escapeHtml(wizard.title)}</p>
        </div>
        <button type="button" onclick="window.previewWizard()"
            class="w-full flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-blue-200 dark:border-blue-800 hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-blue-600 font-black text-lg uppercase tracking-widest">
            <i data-lucide="eye" class="w-6 h-6"></i> Preview Full Proposal
        </button>
    </div>`;
}

function renderStep6(wizard) {
    const stepNum = wizard.type === 'CIS' ? '4' : '6';
    return `
    <div class="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center">
        <div class="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <i data-lucide="check" class="w-10 h-10 text-white"></i>
        </div>
        <h2 class="text-4xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-4">Ready to Submit!</h2>
        <p class="text-slate-500 text-lg mb-8 max-w-2xl mx-auto">Your ${wizard.type} is ready. Click submit to create the proposal.</p>
        <div class="flex items-center justify-center gap-4">
            <button onclick="window.wizardReset()"
                class="px-8 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-black uppercase text-sm tracking-widest hover:-translate-y-1 active:scale-95 transition-all">
                Start Over
            </button>
        </div>
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
    const dayMap = { Procedural: 60, Substantive: 60, Technical: 60, Interpretive: 30, Editorial: 14, Other: 30 };
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
