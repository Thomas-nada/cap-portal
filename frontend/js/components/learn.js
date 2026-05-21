import { API_BASE } from '../config.js';

const SECTION_STYLE = {
    'editor-guides':    { icon: 'shield',           color: 'bg-amber-500' },
    'getting-started':  { icon: 'play',             color: 'bg-blue-600' },
    'writing-caps':     { icon: 'pen-tool',         color: 'bg-purple-600' },
    'using-the-portal': { icon: 'layout-dashboard', color: 'bg-slate-900 dark:bg-white' },
    'constitution':     { icon: 'book-open',        color: 'bg-emerald-600' },
    'developer-api':    { icon: 'code-2',           color: 'bg-indigo-600' },
    'faq':              { icon: 'help-circle',      color: 'bg-red-600' },
};
const DEFAULT_STYLE = { icon: 'file-text', color: 'bg-slate-600' };

export function renderLearnHub(state) {
    if (state.activeGuide) {
        const canEdit = state.user?.is_editor || state.user?.is_admin;
        const lastEdit = state.guideLastEditor
            ? `<span class="text-xs text-slate-400 mt-4 block">Last edited by ${state.guideLastEditor}</span>`
            : '';

        return `
        <div class="max-w-6xl mx-auto pb-20 fade-in text-left">
            <div class="flex items-center justify-between mb-8">
                <button onclick="window.closeGuide()" class="group flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors font-bold uppercase text-xs tracking-widest">
                    <i data-lucide="arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition-transform"></i>
                    Back to Guides
                </button>
                ${canEdit ? `
                <div class="flex items-center gap-2">
                    <button onclick="window.openGuideEditor()"
                        class="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                        <i data-lucide="pencil" class="w-3 h-3"></i>
                        Edit
                    </button>
                    <button onclick="window.deleteGuide('${state.activeGuide}')"
                        class="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                        Delete
                    </button>
                </div>` : ''}
            </div>
            <article id="guide-content" class="bg-white dark:bg-slate-900 p-10 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm prose dark:prose-invert max-w-none">
                ${state.loading?.guide
                    ? '<p class="text-slate-400">Loading…</p>'
                    : state.guideHtml
                        ? state.guideHtml + lastEdit
                        : `<div class="text-center py-12">
                            <p class="text-slate-400 mb-4">No content yet for this guide.</p>
                            ${canEdit ? `<button onclick="window.openGuideEditor()" class="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black transition-colors">Write this guide</button>` : ''}
                           </div>`
                }
            </article>
        </div>`;
    }

    const canEdit = state.user?.is_editor || state.user?.is_admin;

    // Loading state
    if (!state.guidesLoaded) {
        return `
        <div class="max-w-6xl mx-auto pb-20 fade-in text-center py-24">
            <div class="loading-spinner mx-auto mb-4"></div>
            <p class="text-slate-400 font-bold">Loading guides…</p>
        </div>`;
    }

    // Group guides by section
    const sections = new Map();
    for (const g of (state.guides || [])) {
        if (!sections.has(g.section)) {
            sections.set(g.section, { label: g.section_label || g.section.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), guides: [] });
        }
        sections.get(g.section).guides.push(g);
    }

    const sectionCards = [...sections.entries()].map(([sectionKey, sec]) => {
        const style = SECTION_STYLE[sectionKey] || DEFAULT_STYLE;
        const guideButtons = sec.guides.map(g => `
            <div class="flex items-center gap-2 group/guide">
                <button onclick="window.openGuide('${g.slug}')"
                    class="flex-1 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm font-bold text-left hover:-translate-y-0.5 transition-all">
                    ${g.title}
                </button>
                ${canEdit ? `
                <button onclick="window.deleteGuide('${g.slug}')" title="Delete guide"
                    class="opacity-0 group-hover/guide:opacity-100 w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-400 hover:text-red-600 hover:bg-red-100 flex items-center justify-center transition-all shrink-0">
                    <i data-lucide="x" class="w-3 h-3"></i>
                </button>` : ''}
            </div>`).join('');

        return `
        <div class="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm p-10">
            <div class="w-12 h-12 ${style.color} rounded-2xl flex items-center justify-center mb-6 text-white">
                <i data-lucide="${style.icon}" class="w-6 h-6"></i>
            </div>
            <h2 class="text-2xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-4">${sec.label}</h2>
            <div class="space-y-3">
                ${guideButtons}
                ${canEdit ? `
                <button onclick="window.openNewGuideModal()"
                    class="w-full p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-sm font-bold text-left hover:border-blue-300 hover:text-blue-500 transition-all">
                    + Add guide to this section
                </button>` : ''}
            </div>
        </div>`;
    }).join('');

    const emptyState = canEdit ? `
        <div class="col-span-2 text-center py-24">
            <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <i data-lucide="book-open" class="w-8 h-8 text-slate-400"></i>
            </div>
            <h2 class="text-2xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">No guides yet</h2>
            <p class="text-slate-500 mb-6">Create your first guide to get started.</p>
            <button onclick="window.openNewGuideModal()"
                class="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-colors">
                Create First Guide
            </button>
        </div>` : `
        <div class="col-span-2 text-center py-24">
            <p class="text-slate-400">No guides available yet.</p>
        </div>`;

    return `
    <div class="max-w-6xl mx-auto pb-20 fade-in text-left">
        <header class="mb-16">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg text-white">
                        <i data-lucide="graduation-cap" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h1 class="text-6xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Learn &amp; Guide</h1>
                        <p class="text-slate-500 text-xl font-medium mt-2">Master the governance process</p>
                    </div>
                </div>
                ${canEdit ? `
                <button onclick="window.openNewGuideModal()"
                    class="flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest transition-colors">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    New Guide
                </button>` : ''}
            </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            ${sections.size > 0 ? sectionCards : emptyState}

            <!-- Developer API always shown -->
            <div class="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm p-10">
                <div class="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 text-white">
                    <i data-lucide="code-2" class="w-6 h-6"></i>
                </div>
                <h2 class="text-2xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-4">Developer API</h2>
                <p class="text-slate-500 mb-6">Build your own tools on top of the CAP Portal</p>
                <div class="space-y-3">
                    <a href="${API_BASE}/docs" target="_blank" class="block w-full p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-sm font-bold text-left hover:-translate-y-0.5 transition-all">
                        📐 Interactive API Docs →
                    </a>
                </div>
            </div>
        </div>

        <div class="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 p-10 rounded-[3rem] border border-blue-100 dark:border-blue-900/30">
            <h3 class="text-2xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-6 text-center">Ready to Get Started?</h3>
            <div class="flex flex-wrap justify-center gap-4">
                <button onclick="window.setView('wizard')"
                    class="px-8 py-4 rounded-2xl bg-blue-600 text-white font-black uppercase text-sm tracking-widest hover:-translate-y-1 active:scale-95 transition-all shadow-xl flex items-center gap-3">
                    <i data-lucide="wand-2" class="w-5 h-5"></i>
                    Use Amendment Wizard
                </button>
                <button onclick="window.setView('constitution')"
                    class="px-8 py-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 font-black uppercase text-sm tracking-widest hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-3">
                    <i data-lucide="book-open" class="w-5 h-5 text-blue-600"></i>
                    Read Constitution
                </button>
                <button onclick="window.setView('list')"
                    class="px-8 py-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 font-black uppercase text-sm tracking-widest hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-3">
                    <i data-lucide="search" class="w-5 h-5 text-purple-600"></i>
                    Browse CAPs
                </button>
            </div>
        </div>
    </div>`;
}
