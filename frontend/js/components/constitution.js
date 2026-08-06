export const CONSTITUTION_SECTIONS = [
    { id: 'preamble', label: 'Preamble' },
    { id: 'defined-terms', label: 'Defined Terms' },
    { id: 'article-i-tenets-and-guardrails', label: 'Art I: Tenets' },
    { id: 'article-ii-community-and-governance', label: 'Art II: Community' },
    { id: 'article-iii-constitutional-committee', label: 'Art III: Committee' },
    { id: 'article-iv-amendment-process', label: 'Art IV: Amendment' },
    { id: 'appendix-i-guardrails', label: 'App I: Guardrails' },
    { id: 'appendix-ii-supporting-guidance', label: 'App II: Guidance' },
];

// Global text-selection system for the constitution reader (idempotent). Works
// both on the standalone Constitution page and embedded in wizard Step 2.
export function initConstitutionSelection() {
    if (window.selectionHandlerInitialized) return;
    window.selectionHandlerInitialized = true;
    window.stagedSelections = window.stagedSelections || [];
    const inWizard = () => window.state?.view === 'wizard';

    function renderSelectionBar() {
        const col = document.getElementById('constitution-col');
        if (!col) return;
        let bar = document.getElementById('selection-bar');
        if (!window.stagedSelections.length) { if (bar) bar.remove(); return; }
        if (!bar) { bar = document.createElement('div'); bar.id = 'selection-bar'; col.insertBefore(bar, col.firstChild); }
        bar.style.cssText = 'margin-bottom:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;';
        bar.innerHTML = window.stagedSelections.map(s => {
            const preview = s.text.length > 55 ? s.text.slice(0, 52).trimEnd() + '…' : s.text;
            return `<span style="display:inline-flex;align-items:center;gap:8px;background:#2563eb;border-radius:999px;padding:6px 14px;max-width:100%;">
                <span style="color:#fff;font-size:14px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;flex-shrink:0;opacity:.75">${s.type}</span>
                <span style="color:#fff;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px">${preview}</span>
                <button onclick="window.removeSelection('${s.id}')" style="background:rgba(255,255,255,0.2);border:none;color:#fff;cursor:pointer;font-size:14px;font-weight:900;padding:1px 5px;line-height:1;border-radius:999px;flex-shrink:0">✕</button>
            </span>`;
        }).join('');
    }

    function showSelectionPopup(rect) {
        let popup = document.getElementById('selection-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'selection-popup';
            popup.style.cssText = 'position:fixed;z-index:9999;display:flex;align-items:center;gap:6px;background:#1e293b;border-radius:14px;padding:6px 10px;box-shadow:0 8px 32px rgba(0,0,0,0.35);pointer-events:auto;';
            document.body.appendChild(popup);
        }
        const isLoggedIn = !!window.state?.user;
        const btnReplace = `<button onclick="window.commitSelection('CAP','replace')" style="background:#2563eb;color:#fff;border:none;border-radius:10px;padding:5px 13px;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:.05em;white-space:nowrap" title="Replace this text">↔ Replace</button>`;
        const btnAddAfter = `<button onclick="window.commitSelection('CAP','add_after')" style="background:#0891b2;color:#fff;border:none;border-radius:10px;padding:5px 13px;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:.05em;white-space:nowrap" title="Insert new text after this">+ Add After</button>`;
        // In the wizard the type is already CAP, so only offer Replace / Add After,
        // under a small "Select what to edit" heading.
        popup.style.flexDirection = inWizard() ? 'column' : 'row';
        popup.style.alignItems = inWizard() ? 'stretch' : 'center';
        popup.innerHTML = !isLoggedIn
            ? `<span style="color:#94a3b8;font-size:14px;font-weight:700;padding:0 4px">Connect wallet to flag text</span>`
            : inWizard()
            ? `<div style="color:#94a3b8;font-size:14px;font-weight:700;text-align:center;white-space:nowrap;padding:0 2px 4px;">Select what to edit</div>
               <div style="display:flex;gap:6px;justify-content:center;">${btnReplace}${btnAddAfter}</div>`
            : `<span style="color:#64748b;font-size:14px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;padding:0 2px">CAP</span>
               ${btnReplace}${btnAddAfter}
               <button onclick="window.commitSelection('CIS','replace')" style="background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:5px 13px;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:.05em;white-space:nowrap">+ CIS</button>`;
        popup.style.top = '-9999px'; popup.style.left = '-9999px'; popup.style.display = 'flex';
        requestAnimationFrame(() => {
            const h = popup.offsetHeight, pw = popup.offsetWidth;
            const topAbove = rect.top - h - 10, topBelow = rect.bottom + 10;
            const top = topAbove >= 0 ? topAbove : topBelow;
            const left = Math.max(8, Math.min(rect.left + rect.width / 2 - pw / 2, window.innerWidth - pw - 8));
            popup.style.top = `${top}px`; popup.style.left = `${left}px`;
        });
    }

    function hidePopup() {
        const p = document.getElementById('selection-popup');
        if (p) p.style.display = 'none';
    }

    window.commitSelection = (type, kind = 'replace') => {
        if (!window.currentSelection?.text) return;
        const { text, sectionId } = window.currentSelection;
        window.currentSelection = null;
        window.getSelection()?.removeAllRanges();
        hidePopup();

        // Embedded in wizard Step 2: add straight to the proposal and re-render inline.
        if (inWizard()) {
            const w = window.state.wizardData || {};
            const list = (w.selectedText || []).slice();
            if (!list.some(s => s.text === text && s.kind === kind)) {
                list.push({ id: `sel-${Date.now()}`, text, sectionId, type: 'CAP', kind });
            }
            window.state.wizardData = { ...w, selectedText: list, type: 'CAP' };
            window.stagedSelections = [];
            window.updateUI(true);
            return;
        }

        // Standalone Constitution page: keep the "start a CAP here" flow.
        if (!window.stagedSelections.some(s => s.text === text && s.type === type && s.kind === kind)) {
            window.stagedSelections.push({ id: `sel-${Date.now()}`, text, sectionId, type, kind });
        }
        if (type === 'CAP') window.addTextToCAP?.();
        else window.addTextToCIS?.();
        renderSelectionBar();
    };

    window.removeSelection = (id) => {
        window.stagedSelections = window.stagedSelections.filter(s => s.id !== id);
        renderSelectionBar();
    };

    window.clearConstitutionSelection = () => {
        window.currentSelection = null; window.stagedSelections = [];
        window.getSelection()?.removeAllRanges(); hidePopup(); renderSelectionBar();
    };

    document.addEventListener('mouseup', (e) => {
        if (document.getElementById('selection-popup')?.contains(e.target)) return;
        try {
            const selection = window.getSelection();
            const text = selection.toString().trim();
            if (text.length > 3 && !window.state?.constitutionCompareVersion) {
                let node = selection.anchorNode, inside = false;
                while (node && node !== document.body) {
                    const el = node.nodeType === 1 ? node : node.parentElement;
                    if (!el) break;
                    if (el.id === 'constitution-content') { inside = true; break; }
                    node = el.parentElement;
                }
                if (!inside) return;
                node = selection.anchorNode;
                let contextId = 'General';
                while (node && node !== document.body) {
                    const target = node.nodeType === 1 ? node : node.parentElement;
                    if (target?.id) { contextId = target.id; break; }
                    let sib = target?.previousElementSibling;
                    while (sib) { if (sib.id) { contextId = sib.id; break; } sib = sib.previousElementSibling; }
                    if (contextId !== 'General') break;
                    node = target?.parentElement;
                }
                const sectionId = contextId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                window.currentSelection = { text, sectionId };
                showSelectionPopup(selection.getRangeAt(0).getBoundingClientRect());
            } else { hidePopup(); }
        } catch (err) { console.warn('Selection handler error:', err); }
    });

    document.addEventListener('keydown', e => { if (e.key === 'Escape') window.clearConstitutionSelection?.(); });
}

export function renderConstitution(state) {
    if (state.loading?.constitution) {
        return `
 <div class="flex items-center justify-center py-40">
 <div class="flex flex-col items-center gap-6">
 <div class="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
 <p class="text-slate-400 font-bold uppercase tracking-widest text-sm text-center">Loading Constitution…</p>
            </div>
        </div>`;
    }

    if (!state.constitutionVersions?.length) {
        return `
 <div class="max-w-7xl mx-auto pb-20 fade-in text-center">
 <div class="bg-white/80 p-20 rounded-[4rem] border border-dashed border-slate-200 ">
 <i data-lucide="alert-circle" class="w-16 h-16 text-slate-400 mx-auto mb-6"></i>
 <p class="text-slate-400 font-bold uppercase tracking-widest text-sm mb-4">No Constitution Versions Available</p>
                <button onclick="window.reloadConstitution()"
 class="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all">
                    Retry
                </button>
            </div>
        </div>`;
    }

    const isDiffMode = state.constitutionCompareVersion !== null;
    const currentVersion = state.constitutionVersions.find(v => v.name === state.constitutionCurrentVersion);
    const compareVersion = isDiffMode ? state.constitutionVersions.find(v => v.name === state.constitutionCompareVersion) : null;
    // In diff mode the "Before" side is always the ratified (current) constitution,
    // and "After" is the proposed draft being compared.
    const baseVersion = state.constitutionVersions.find(v => v.isCurrent) || state.constitutionVersions[0];

    initConstitutionSelection();
    const sections = CONSTITUTION_SECTIONS;

    return `
 <div class="max-w-7xl mx-auto pb-20 fade-in text-left relative">
 <header class="mb-12">
 <div class="flex items-center gap-4 mb-4">
 <div class="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg text-white">
 <i data-lucide="book-open" class="w-6 h-6"></i>
                </div>
                <div>
 <h1 class="text-3xl sm:text-4xl font-black italic tracking-tighter text-on-surface uppercase leading-none">Constitution</h1>
 <p class="text-on-surface-variant text-xl font-medium mt-2">Foundational governance document</p>
                </div>
            </div>
            ${!isDiffMode ? `
 <div class="mt-6 flex items-start gap-3 px-5 py-4 bg-blue-50 border border-blue-100 rounded-2xl">
 <i data-lucide="mouse-pointer-2" class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5"></i>
 <p class="text-sm text-blue-700 font-medium leading-relaxed">
 <span class="font-black">Proposing a change?</span>
 Highlight any section of the text. Click <span class="font-black">+ CAP</span> to flag as a Constitutional Amendment Proposal, or <span class="font-black">+ CIS</span> as a Constitutional Issue Statement.
                </p>
            </div>
            ` : ''}
        </header>

 <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
 <aside class="lg:col-span-1 space-y-6 lg:sticky lg:top-8 h-fit">
                <!-- Version Selector -->
 <div class="bg-white/80 p-6 rounded-[2rem] border border-slate-100 shadow-sm">
 <h3 class="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Version</h3>
                    <select onchange="window.switchConstitutionVersion(this.value)"
 class="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
                        ${state.constitutionVersions.map(v => `
                        <option value="${v.name}" ${v.name === state.constitutionCurrentVersion ? 'selected' : ''}>
                            ${v.name} ${v.isCurrent ? '(Current)' : ''}
                        </option>
                        `).join('')}
                    </select>
                </div>

                <!-- Download -->
                <button onclick="window.downloadConstitution()"
 class="w-full px-4 py-3 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-600 font-bold text-sm hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
 <i data-lucide="download" class="w-4 h-4"></i>
                    Download (.txt)
                </button>

                <!-- Diff Mode -->
 <div class="bg-white/80 p-6 rounded-[2rem] border border-slate-100 shadow-sm">
 <h3 class="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Compare Mode</h3>
                    ${!isDiffMode ? `
                    <button onclick="window.enableDiffMode()"
 class="w-full px-4 py-3 rounded-xl bg-blue-50 border-2 border-blue-200 text-blue-600 font-bold text-sm hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
 <i data-lucide="git-compare" class="w-4 h-4"></i>
                        Enable Diff View
                    </button>
                    ` : `
                    <p class="text-sm text-slate-400 mb-2">Comparing against <span class="font-bold text-slate-600">${baseVersion?.name || 'the current constitution'}</span>:</p>
                    <select onchange="window.setCompareVersion(this.value)"
 class="w-full p-3 rounded-xl border border-slate-200 bg-white/80 text-slate-900 font-bold text-sm focus:outline-none mb-3">
                        ${state.constitutionVersions.filter(v => v.name !== baseVersion?.name).map(v => `
                        <option value="${v.name}" ${v.name === state.constitutionCompareVersion ? 'selected' : ''}>${v.name}</option>
                        `).join('')}
                    </select>
                    <button onclick="window.disableDiffMode()"
 class="w-full px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
 <i data-lucide="x" class="w-4 h-4"></i> Exit Diff Mode
                    </button>
                    `}
                </div>

                <!-- Navigation -->
 <div class="bg-white/80 p-6 rounded-[2rem] border border-slate-100 shadow-sm">
 <h3 class="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Jump To</h3>
 <div class="space-y-1 max-h-96 overflow-y-auto">
                        ${sections.map(s => `
 <a href="#${s.id}" class="block px-3 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                            ${s.label}
                        </a>
                        `).join('')}
                    </div>
                </div>

                ${isDiffMode ? `
 <div class="bg-white/80 p-6 rounded-[2rem] border border-slate-100 shadow-sm">
 <h3 class="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Legend</h3>
 <div class="space-y-2 text-sm font-bold text-slate-600 ">
 <div class="flex items-center gap-2"><div class="w-4 h-4 bg-red-400 rounded"></div><span>Removed</span></div>
 <div class="flex items-center gap-2"><div class="w-4 h-4 bg-green-400 rounded"></div><span>Added</span></div>
 <div class="flex items-center gap-2"><div class="w-4 h-4 bg-blue-400 rounded"></div><span>Modified</span></div>
                    </div>
                </div>
                ` : ''}
            </aside>

 <div id="constitution-col" class="lg:col-span-3">
                ${isDiffMode && state.constitutionDiffNotice ? `
                <div class="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-5 py-4">
                    <i data-lucide="alert-triangle" class="w-5 h-5 flex-shrink-0 mt-0.5"></i>
                    <div class="text-sm">
                        <p class="font-bold">Some proposed changes couldn't be matched to the current constitution.</p>
                        <p class="mt-1">${state.constitutionDiffNotice.applied} of ${state.constitutionDiffNotice.total} revision${state.constitutionDiffNotice.total !== 1 ? 's' : ''} were applied. This usually means a revision's original passage was copied from the rendered page and no longer matches the source text exactly (e.g. missing list numbering). The diff below may be partial.</p>
                    </div>
                </div>` : ''}
                ${isDiffMode ? renderDiffView(baseVersion, compareVersion) : renderSingleView(currentVersion)}
            </div>
        </div>
    </div>`;
}

export function renderSingleView(version, embedded = false) {
 if (!version?.content) return '<p class="text-slate-400">Constitution content not available.</p>';
    let content = version.content;
    content = content.replace(/<!--[\s\S]*?-->/g, '').trimStart();

    const sectionMappings = [
        { id: 'preamble', patterns: [/preamble/i] },
        { id: 'defined-terms', patterns: [/defined\s+terms/i] },
        { id: 'article-i-tenets-and-guardrails', patterns: [/article\s+i(?:[^iv]|$)/i] },
        { id: 'article-ii-community-and-governance', patterns: [/article\s+ii(?:[^i]|$)/i] },
        { id: 'article-iii-constitutional-committee', patterns: [/article\s+iii(?:[^i]|$)/i] },
        { id: 'article-iv-amendment-process', patterns: [/article\s+iv/i] },
        { id: 'appendix-i-guardrails', patterns: [/appendix\s+i(?:[^i]|$)/i] },
        { id: 'appendix-ii-supporting-guidance', patterns: [/appendix\s+ii/i] }
    ];

    let html = window.safeMarkdown(content) || `<pre>${escapeHtml(content)}</pre>`;
    html = html.replace(/<h2[^>]*>(.*?)<\/h2>/gi, (match, headerText) => {
        for (const mapping of sectionMappings) {
            for (const pattern of mapping.patterns) {
                if (pattern.test(headerText)) {
 return `<h2 id="${mapping.id}" class="scroll-mt-32 font-black italic tracking-tighter text-3xl uppercase text-slate-900 mt-16 mb-8 border-b border-slate-100 pb-4">${headerText}</h2>`;
                }
            }
        }
        const defaultId = headerText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
 return `<h2 id="${defaultId}" class="scroll-mt-32 font-black italic tracking-tighter text-3xl uppercase text-slate-900 mt-16 mb-8 border-b border-slate-100 pb-4">${headerText}</h2>`;
    });

    // Embedded (wizard Step 2) sits flush inside its own scroll container, so it
    // drops the big rounded card chrome to avoid a card-in-a-card corner clash.
    const cls = embedded
        ? 'bg-white p-6 sm:p-10 prose max-w-none text-left leading-relaxed selection:bg-blue-600 selection:text-white'
        : 'bg-white/80 p-10 sm:p-20 rounded-[4rem] border border-slate-100 shadow-sm prose max-w-none text-left leading-relaxed selection:bg-blue-600 selection:text-white';
    return `
 <article id="constitution-content" class="${cls}">
        ${html}
    </article>`;
}

// ── Diff engine ──────────────────────────────────────────────────────────────

// Word-level diff on small text chunks (paragraphs, not whole documents)
function wordDiff(oldStr, newStr) {
    const tok = t => t.match(/[^\s]+|\s+/g) || [];
    const ow = tok(oldStr), nw = tok(newStr);
    const m = ow.length, n = nw.length;
    const dp = Array.from({length: m+1}, () => new Int32Array(n+1));
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = ow[i-1] === nw[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
    const wOps = []; let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && ow[i-1] === nw[j-1]) { wOps.push({t:'eq',v:ow[i-1]}); i--; j--; }
        else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { wOps.push({t:'ins',v:nw[j-1]}); j--; }
        else { wOps.push({t:'del',v:ow[i-1]}); i--; }
    }
    wOps.reverse();
    let oH = '', nH = '', k = 0;
    while (k < wOps.length) {
        const op = wOps[k];
        if (op.t === 'eq') { const v = escapeHtml(op.v); oH += v; nH += v; k++; }
        else if (op.t === 'del' && k+1 < wOps.length && wOps[k+1].t === 'ins') {
 oH += `<mark class="diff-del">${escapeHtml(op.v)}</mark>`;
 nH += `<mark class="diff-rep">${escapeHtml(wOps[k+1].v)}</mark>`;
            k += 2;
 } else if (op.t === 'del') { oH += `<mark class="diff-del">${escapeHtml(op.v)}</mark>`; k++; }
 else { nH += `<mark class="diff-ins">${escapeHtml(op.v)}</mark>`; k++; }
    }
    return { oH, nH };
}

// Process a run of del/ins line ops into highlighted HTML for both panels
function applyLineGroup(delLines, insLines) {
    const delStr = delLines.join('\n'), insStr = insLines.join('\n');
    if (delStr && insStr) {
        const { oH, nH } = wordDiff(delStr, insStr);
        return { oH: oH + '\n', nH: nH + '\n' };
    } else if (delStr) {
 return { oH: `<mark class="diff-del">${escapeHtml(delStr)}</mark>\n`, nH: '' };
    } else {
 return { oH: '', nH: `<mark class="diff-ins">${escapeHtml(insStr)}</mark>\n` };
    }
}

function renderDiffView(currentVersion, compareVersion) {
 if (!currentVersion || !compareVersion) return '<p class="text-slate-400 p-10">Missing version data.</p>';
    const oldText = (currentVersion.content || '').replace(/\r\n/g, '\n');
    const newText = (compareVersion.content || '').replace(/\r\n/g, '\n');
    if (oldText === newText) {
        return `
 <div class="bg-white/80 p-20 rounded-[4rem] border border-slate-100 shadow-sm text-center">
 <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
 <i data-lucide="check-circle" class="w-8 h-8 text-green-500"></i>
            </div>
 <p class="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">No Differences Found</p>
 <p class="text-slate-500 text-sm">These two versions appear to be identical.</p>
        </div>`;
    }

    // Line-level LCS — O(lines²) not O(words²), so fast even on large docs
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const m = oldLines.length, n = newLines.length;
    const dp = Array.from({length: m+1}, () => new Int32Array(n+1));
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = oldLines[i-1] === newLines[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
    const lineOps = []; let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i-1] === newLines[j-1]) { lineOps.push({t:'eq',v:oldLines[i-1]}); i--; j--; }
        else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { lineOps.push({t:'ins',v:newLines[j-1]}); j--; }
        else { lineOps.push({t:'del',v:oldLines[i-1]}); i--; }
    }
    lineOps.reverse();

    // ── Full-text HTML ────────────────────────────────────────────────────────
    let oldHtml = '', newHtml = '';
    { let k = 0;
      while (k < lineOps.length) {
        if (lineOps[k].t === 'eq') {
            const v = escapeHtml(lineOps[k].v); oldHtml += v + '\n'; newHtml += v + '\n'; k++;
        } else {
            const delLines = [], insLines = [];
            while (k < lineOps.length && lineOps[k].t !== 'eq') {
                if (lineOps[k].t === 'del') delLines.push(lineOps[k].v);
                else insLines.push(lineOps[k].v);
                k++;
            }
            const { oH, nH } = applyLineGroup(delLines, insLines);
            oldHtml += oH; newHtml += nH;
        }
      }
    }

    // ── Changes-only cards ────────────────────────────────────────────────────
    let changeCards = '';
    { let k = 0;
      while (k < lineOps.length) {
        if (lineOps[k].t === 'eq') { k++; continue; }
        const delLines = [], insLines = [];
        while (k < lineOps.length && lineOps[k].t !== 'eq') {
            if (lineOps[k].t === 'del') delLines.push(lineOps[k].v);
            else insLines.push(lineOps[k].v);
            k++;
        }
        const { oH, nH } = applyLineGroup(delLines, insLines);
 const none = '<span class="text-slate-300 italic text-sm">nothing</span>';
 changeCards += `<div class="bg-white/80 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
 <div class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 ">
 <div class="p-6"><p class="text-sm font-black uppercase tracking-widest text-red-400 mb-3">Before</p><p class="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">${oH.trim() || none}</p></div>
 <div class="p-6"><p class="text-sm font-black uppercase tracking-widest text-green-500 mb-3">After</p><p class="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">${nH.trim() || none}</p></div>
            </div>
        </div>`;
      }
    }

    return `
 <div class="space-y-4">
 <div class="bg-white/80 p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
 <div class="flex flex-wrap items-center gap-4">
                <div>
 <p class="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Comparing versions</p>
 <p class="text-lg font-black text-slate-900 ">
 ${escapeHtml(currentVersion.name)} <span class="text-slate-400 font-normal mx-2">→</span> ${escapeHtml(compareVersion.name)}
                    </p>
                </div>
 <div class="ml-auto flex items-center gap-3 flex-wrap">
 <div class="flex items-center gap-2 text-sm font-bold">
 <mark class="diff-del rounded px-2 py-0.5">removed</mark>
 <mark class="diff-ins rounded px-2 py-0.5">added</mark>
 <mark class="diff-rep rounded px-2 py-0.5">replaced</mark>
                    </div>
                    <button onclick="
                        const full=document.getElementById('diff-view-full');
                        const changes=document.getElementById('diff-view-changes');
                        const showingFull=!full.classList.contains('hidden');
                        full.classList.toggle('hidden',showingFull);
                        changes.classList.toggle('hidden',!showingFull);
                        document.getElementById('diff-toggle-label').textContent=showingFull?'Show Full Text':'Show Changes Only';
 " class="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm font-bold hover:bg-slate-100 transition-colors">
 <i data-lucide="layers" class="w-3.5 h-3.5"></i>
                        <span id="diff-toggle-label">Show Changes Only</span>
                    </button>
                </div>
            </div>
        </div>
 <div id="diff-view-full" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <div class="bg-white/80 rounded-[2.5rem] border border-red-100 shadow-sm overflow-hidden flex flex-col">
 <div class="px-8 py-4 border-b border-red-100 bg-red-50 shrink-0">
 <p class="text-sm font-black uppercase tracking-widest text-red-500">Before — ${escapeHtml(currentVersion.name)}</p>
                </div>
 <div class="p-8 overflow-auto max-h-[75vh]">
 <pre class="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-sans m-0">${oldHtml}</pre>
                </div>
            </div>
 <div class="bg-white/80 rounded-[2.5rem] border border-green-100 shadow-sm overflow-hidden flex flex-col">
 <div class="px-8 py-4 border-b border-green-100 bg-green-50 shrink-0">
 <p class="text-sm font-black uppercase tracking-widest text-green-600">After — ${escapeHtml(compareVersion.name)}</p>
                </div>
 <div class="p-8 overflow-auto max-h-[75vh]">
 <pre class="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-sans m-0">${newHtml}</pre>
                </div>
            </div>
        </div>
 <div id="diff-view-changes" class="hidden space-y-3">
            ${changeCards}
        </div>
    </div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
