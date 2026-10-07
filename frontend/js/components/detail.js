import { shortAddress, formatUser } from '../wallet.js';
import { revisionHasEffect, countEffectiveRevisions } from '../revisions.js';

function stripFrontmatter(body) {
    if (!body) return '';
    return body.replace(/^---[\s\S]*?---\s*/m, '').trimStart();
}

function md(text) {
    return window.safeMarkdown(text);
}

function renderStructuredBody(s, type, counts = {}) {
 if (!s) return '<p class="text-slate-400">No content.</p>';
    const isCIS = type === 'CIS';
    const sections = [];
    // Each section is addressable (jump bar, comment topics) and shows how many
    // comments are about it.
    const sec = (key, title, html) => `<section id="sec-${key}" class="scroll-mt-40"><h2>${title}${topicBadge(key, counts)}</h2>${html}</section>`;

    if (s.abstract)    sections.push(sec('abstract', 'Summary', md(s.abstract)));
    if (isCIS) {
        if (s.motivation) sections.push(sec('motivation', 'Problem', md(s.motivation)));
        if (s.analysis)   sections.push(sec('analysis', 'Context', md(s.analysis)));
        if (s.impact)     sections.push(sec('impact', 'Impact', md(s.impact)));
    } else {
        if (s.motivation) sections.push(sec('motivation', 'Why is this change needed?', md(s.motivation)));
        if (s.analysis)   sections.push(sec('analysis', 'Analysis &amp; Test', md(s.analysis)));
    }

    if (s.revisions?.length) {
        const revHtml = s.revisions.map((r, i) => r.type === 'deletion' ? `
 <div id="rev-${i + 1}" class="rounded-2xl border border-red-100 overflow-hidden mb-4 scroll-mt-40">
 <div class="px-5 py-2 bg-red-50 text-sm font-black text-red-400 uppercase tracking-widest flex items-center gap-2"><span>Revision ${i + 1}</span>${r.section ? `<span class="font-bold normal-case tracking-normal text-slate-400">· ${escapeHtml(r.section)}</span>` : ''}${topicBadge(`revisions[${i}]`, counts)}</div>
 <div class="p-5">
 <div class="text-sm font-black uppercase tracking-widest text-red-500 mb-2">Removed</div>
 <div class="text-sm text-slate-500 font-mono leading-relaxed whitespace-pre-wrap line-through">${escapeHtml(r.original || '')}</div>
                    </div>
            </div>` : r.type === 'addition' ? `
 <div id="rev-${i + 1}" class="rounded-2xl border border-cyan-100 overflow-hidden mb-4 scroll-mt-40">
 <div class="px-5 py-2 bg-cyan-50 text-sm font-black text-cyan-500 uppercase tracking-widest flex items-center gap-2"><span>Revision ${i + 1}</span>${r.section ? `<span class="font-bold normal-case tracking-normal text-slate-400">· ${escapeHtml(r.section)}</span>` : ''}${topicBadge(`revisions[${i}]`, counts)}</div>
 <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-cyan-100 ">
 <div class="p-5">
 <div class="text-sm font-black uppercase tracking-widest text-cyan-500 mb-2">Insert After</div>
 <div class="text-sm text-slate-600 font-mono leading-relaxed italic whitespace-pre-wrap">${escapeHtml(r.insert_after || '')}</div>
                    </div>
 <div class="p-5">
 <div class="text-sm font-black uppercase tracking-widest text-cyan-600 mb-2">New Text</div>
 <div class="text-sm text-slate-900 font-mono leading-relaxed whitespace-pre-wrap">${escapeHtml(r.proposed || '')}</div>
                    </div>
                </div>
            </div>` : `
 <div id="rev-${i + 1}" class="rounded-2xl border border-slate-100 overflow-hidden mb-4 scroll-mt-40">
 <div class="px-5 py-2 bg-slate-50 text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><span>Revision ${i + 1}</span>${r.section ? `<span class="font-bold normal-case tracking-normal text-slate-400">· ${escapeHtml(r.section)}</span>` : ''}${topicBadge(`revisions[${i}]`, counts)}</div>
 <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 ">
 <div class="p-5">
 <div class="text-sm font-black uppercase tracking-widest text-red-400 mb-2">Original</div>
 <div class="text-sm text-slate-600 font-mono leading-relaxed whitespace-pre-wrap">${escapeHtml(r.original || '')}</div>
                    </div>
 <div class="p-5">
 <div class="text-sm font-black uppercase tracking-widest text-green-500 mb-2">Proposed</div>
 <div class="text-sm text-slate-900 font-mono leading-relaxed whitespace-pre-wrap">${escapeHtml(r.proposed || '')}</div>
                    </div>
                </div>
            </div>`).join('');
        sections.push(`<section id="sec-revisions" class="scroll-mt-40"><h2>Proposed Revisions</h2>${revHtml}</section>`);
    }

    if (s.exhibits)    sections.push(sec('exhibits', 'Links &amp; Files', md(s.exhibits)));

    return sections.join('\n');
}

// ── Discussion navigation helpers ────────────────────────────────────────────
// A comment's `about` is a section key ("abstract", …) or "revisions[i]"; null
// means the proposal in general. These map it to a label and to the id of the
// element on the page it refers to.
const SECTION_KEYS = ['abstract', 'motivation', 'analysis', 'impact', 'exhibits'];
function sectionLabel(key, isCIS) {
    return { abstract: 'Summary', motivation: isCIS ? 'Problem' : 'Why is this change needed?',
             analysis: isCIS ? 'Context' : 'Analysis & Test', impact: 'Impact', exhibits: 'Links & Files' }[key] || key;
}
function aboutLabel(about, isCIS) {
    if (!about) return 'General';
    const m = /^revisions\[(\d+)\]$/.exec(about);
    return m ? `Revision ${Number(m[1]) + 1}` : sectionLabel(about, isCIS);
}
function aboutTargetId(about) {
    if (!about) return 'discussion';
    const m = /^revisions\[(\d+)\]$/.exec(about);
    return m ? `rev-${Number(m[1]) + 1}` : `sec-${about}`;
}
// Comments per topic, replies included, so a section badge reflects the whole conversation about it.
function commentCountsByAbout(comments) {
    const counts = {};
    for (const c of comments || []) { const k = c.about || ''; counts[k] = (counts[k] || 0) + 1; }
    return counts;
}
function topicBadge(about, counts) {
    const n = counts[about] || 0;
    if (!n) return '';
    return `<button type="button" onclick="window.filterDiscussion('${about}')" title="Show the ${n} comment${n === 1 ? '' : 's'} about this"
 class="not-prose inline-flex items-center gap-1 ml-3 align-middle px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-bold hover:bg-blue-100 transition-colors">
 <i data-lucide="message-square" class="w-3.5 h-3.5"></i> ${n}</button>`;
}
// The parts of a proposal a comment can be about, for the comment form's picker.
function aboutOptions(s, type) {
    const isCIS = type === 'CIS';
    const opts = [{ value: '', label: 'The proposal in general' }];
    for (const k of SECTION_KEYS) if (s?.[k]) opts.push({ value: k, label: sectionLabel(k, isCIS) });
    (s?.revisions || []).forEach((r, i) => {
        const passage = (r.type === 'addition' ? r.insert_after : r.original) || '';
        opts.push({ value: `revisions[${i}]`, label: `Revision ${i + 1}: ${passage.slice(0, 50)}${passage.length > 50 ? '…' : ''}` });
    });
    return opts;
}

// Sticky row of jump chips so a long proposal and its discussion can be
// navigated without scrolling blind. Jumps scroll rather than set the hash.
function renderJumpBar(p, commentCount) {
    const s = p.structured || {};
    const isCIS = p.type === 'CIS';
    const items = [];
    for (const k of SECTION_KEYS) if (s[k]) items.push({ id: `sec-${k}`, label: sectionLabel(k, isCIS) });
    if (s.revisions?.length) items.push({ id: 'sec-revisions', label: `Revisions (${s.revisions.length})` });
    items.push({ id: 'discussion', label: `Discussion (${commentCount})`, accent: true });
    if (!items.length) return '';
    const chip = (it) => `<button type="button" onclick="window.scrollToId('${it.id}')"
 class="px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${it.accent ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 hover:bg-slate-100'}">${escapeHtml(it.label)}</button>`;
    return `
 <nav id="jump-bar" class="sticky top-24 z-30 -mx-4 sm:mx-0 px-4 sm:px-3 py-2 bg-white/90 backdrop-blur border-y sm:border border-slate-200 sm:rounded-2xl shadow-sm flex items-center gap-1 overflow-x-auto">
 <span class="text-sm font-black uppercase tracking-widest text-slate-400 mr-2 flex-shrink-0 hidden sm:inline">Jump to</span>
        ${items.map(chip).join('')}
 <button type="button" onclick="window.scrollTo({top: 0, behavior: 'smooth'})" title="Back to top"
 class="ml-auto flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><i data-lucide="arrow-up" class="w-4 h-4"></i></button>
    </nav>`;
}

// Fold a long comment body so a thread of essays stays scannable; the reader
// opens the ones they want.
const LONG_COMMENT_CHARS = 1200;
const LONG_COMMENT_LINES = 14;
function isLongComment(body) {
    return (body || '').length > LONG_COMMENT_CHARS || (body || '').split('\n').length > LONG_COMMENT_LINES;
}

function escapeHtml(str) {
    // Quotes escaped too, so values are safe inside attribute contexts.
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Threaded comments ─────────────────────────────────────────────────────────
// Renders one comment plus its replies, recursively. `depth` drives indentation;
// past a few levels we stop indenting (mobile width) but keep the "Replying to"
// label so who-answered-whom stays clear no matter how deep the thread goes.
// Total number of comments beneath `id` (replies, their replies, and so on).
function countDescendants(id, childrenOf) {
    const kids = childrenOf.get(id) || [];
    return kids.reduce((n, k) => n + 1 + countDescendants(k.id, childrenOf), 0);
}

function renderCommentNode(c, ctx, depth) {
    const { byId, childrenOf, state, isEditor, isAdmin, proposal } = ctx;
    const cName = c.author_display_name || shortAddress(c.author_stake_address);
    const isCIS = proposal?.type === 'CIS';
    // Who is speaking: the author, a co-author, or an editor.
    const role = proposal && c.author_stake_address === proposal.author_stake_address ? 'Author'
        : (proposal?.co_authors || []).some(ca => ca.stake_address === c.author_stake_address) ? 'Co-author'
        : (state.editors || []).some(e => e.stake_address === c.author_stake_address) ? 'Editor' : null;
    const roleBadge = role ? `<span class="text-sm font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${role === 'Editor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-600 text-white'}">${role}</span>` : '';
    const parentAbout = c.parent_id != null ? byId.get(c.parent_id)?.about : undefined;
    // Show the topic on root comments and on replies that change topic.
    const topicChip = c.about && (depth === 0 || c.about !== parentAbout) ? `<button type="button" onclick="window.scrollToId('${aboutTargetId(c.about)}')" title="Go to what this comment is about"
 class="text-sm font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors">About: ${escapeHtml(aboutLabel(c.about, isCIS))}</button>` : '';
    const folded = isLongComment(c.body) && !(state.expandedComments instanceof Set && state.expandedComments.has(c.id));
    const words = (c.body || '').trim().split(/\s+/).length;
    const cAddr = shortAddress(c.author_stake_address);
    const mod = c.moderation_status || 'visible';
    const modBadge = mod === 'under_review'
        ? `<span class="text-sm font-black px-2 py-1 rounded-full bg-amber-500 text-white uppercase tracking-wider flex items-center gap-1"><i data-lucide="eye-off" class="w-2.5 h-2.5"></i> Under review</span>`
        : mod === 'removed'
        ? `<span class="text-sm font-black px-2 py-1 rounded-full bg-red-600 text-white uppercase tracking-wider flex items-center gap-1"><i data-lucide="ban" class="w-2.5 h-2.5"></i> Removed</span>`
        : '';
    const cardBorder = mod === 'removed' ? 'border-red-200' : mod === 'under_review' ? 'border-amber-200' : 'border-slate-200';
    const canFlag = (isEditor || isAdmin) && mod === 'visible';
    const canSetTopic = (isEditor || isAdmin) && mod === 'visible';   // editors file any comment
    const canReply = !!state.user && mod === 'visible';
    const canEdit = !!state.user && state.user.stake_address === c.author_stake_address && mod === 'visible';
    const editing = state.editingComment === c.id;
    const editLoading = state.loading?.[`editComment-${c.id}`];
    const parent = c.parent_id != null ? byId.get(c.parent_id) : null;
    const parentName = parent ? (parent.author_display_name || shortAddress(parent.author_stake_address)) : null;
    const kids = childrenOf.get(c.id) || [];
    const replying = state.replyingTo === c.id;
    const replyLoading = state.loading?.[`postReply-${c.id}`];
    const canIndent = depth < 5;
    const isCollapsed = !!(state.collapsedComments && state.collapsedComments.has(c.id));
    const descendants = kids.length ? countDescendants(c.id, childrenOf) : 0;

    // Roots read as bold, self-contained posts (white card, big avatar, boxed as
    // a whole thread); replies are lighter and smaller so a thread is instantly
    // distinguishable from a top-level comment at a glance.
    const isRoot = depth === 0;
    // Root = a boxed, self-contained thread group (visible slate box, white card);
    // replies = lighter and smaller, in their own tinted bubble under a blue
    // connector line, so the nesting reads at a glance even in light mode.
    const nodeWrap = isRoot
        ? 'rounded-[2rem] border border-slate-200 bg-slate-50 p-4 sm:p-6 space-y-5 shadow-sm'
        : 'space-y-5';
    const avatarWrap = isRoot
        ? 'w-11 h-11 sm:w-14 sm:h-14 rounded-3xl bg-slate-200'
        : 'w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-50 ring-1 ring-blue-200';
    const avatarIcon = isRoot ? 'w-5 h-5 sm:w-6 sm:h-6 text-slate-500' : 'w-4 h-4 sm:w-5 sm:h-5 text-blue-600';
    const cardBase = isRoot
        ? 'bg-white p-5 sm:p-7 rounded-[1.75rem] shadow-sm'
        : 'bg-[#eef2f8] p-4 sm:p-5 rounded-[1.5rem]';
    const nameSize = isRoot ? 'text-base' : 'text-sm';

    return `
 <div id="comment-${c.id}" class="${nodeWrap} scroll-mt-40">
 <div class="flex gap-4 sm:gap-8 group ${mod !== 'visible' ? 'opacity-80' : ''}">
 <div class="${avatarWrap} flex items-center justify-center flex-shrink-0">
 <i data-lucide="user" class="${avatarIcon}"></i>
                                    </div>
 <div class="flex-grow min-w-0 space-y-4">
 <div class="flex items-center gap-3 sm:gap-4 flex-wrap">
 <div class="flex flex-col leading-tight">
 <span class="${nameSize} font-black text-slate-900 ">${escapeHtml(cName)}</span>
 <span class="text-sm text-slate-400 font-mono">(${cAddr})</span>
                                            </div>
                                            ${roleBadge}
                                            ${topicChip}
                                            ${parentName ? `<span class="text-sm font-bold text-blue-600 flex items-center gap-1"><i data-lucide="corner-down-right" class="w-3 h-3"></i> Replying to ${escapeHtml(parentName)}</span>` : ''}
 <span class="text-sm font-bold text-slate-400 uppercase tracking-tighter">${new Date(c.created_at).toLocaleString()}</span>
                                            ${modBadge}
 <div class="ml-auto flex items-center gap-1">
                                                ${canSetTopic && !editing ? `
                                                <select title="Set what this comment is about" onchange="window.applyCommentTopic(${c.id}, this.value)"
 class="text-sm font-bold rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-500 hover:border-blue-400 outline-none max-w-[13rem] truncate">
                                                    ${aboutOptions(proposal?.structured, proposal?.type).map(o => `<option value="${o.value}" ${(c.about || '') === o.value ? 'selected' : ''}>${escapeHtml(o.value ? 'Topic: ' + o.label : 'Topic: general')}</option>`).join('')}
                                                </select>
                                                ` : ''}
                                                ${canReply ? `
                                                <button onclick="window.replyToComment(${c.id})" title="Reply to this comment"
 class="text-slate-400 hover:text-blue-600 transition-all p-1.5 rounded-lg hover:bg-blue-50 flex items-center gap-1 text-sm font-black uppercase tracking-wide">
 <i data-lucide="reply" class="w-3.5 h-3.5"></i> Reply
                                                </button>
                                                ` : ''}
                                                ${canEdit ? `
                                                <button onclick="window.editComment(${c.id})" title="Edit your comment"
 class="text-slate-400 hover:text-blue-600 transition-all p-1.5 rounded-lg hover:bg-blue-50 flex items-center gap-1 text-sm font-black uppercase tracking-wide">
 <i data-lucide="pencil" class="w-3.5 h-3.5"></i> Edit
                                                </button>
                                                ` : ''}
                                                ${canFlag ? `
                                                <button onclick="window.flagCommentForRemoval(${c.id})" title="Flag this comment for removal"
 class="text-slate-300 hover:text-red-500 transition-all p-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1 text-sm font-black uppercase tracking-wide opacity-0 group-hover:opacity-100">
 <i data-lucide="flag" class="w-3.5 h-3.5"></i> Flag
                                                </button>
                                                ` : ''}
                                            </div>
                                        </div>
                                        ${editing ? `
 <form onsubmit="event.preventDefault(); window.saveCommentEdit(${c.id}, this)" class="space-y-3">
 <div class="flex flex-wrap items-center gap-3">
 <label class="text-sm font-black uppercase tracking-widest text-slate-400">About</label>
 <select name="about" class="text-sm font-bold rounded-xl border-2 border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500 max-w-full">
                                                    ${aboutOptions(proposal?.structured, proposal?.type).map(o => `<option value="${o.value}" ${(c.about || '') === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
                                                </select>
                                            </div>
                                            <textarea id="edit-input-${c.id}" name="body" required maxlength="20000"
 class="w-full bg-white/80 p-5 rounded-2xl min-h-[200px] font-medium outline-none border-2 border-slate-100 focus:border-blue-600 transition-all text-slate-900 shadow-sm resize-none">${escapeHtml(c.body)}</textarea>
 <div class="flex justify-end gap-3">
                                                <button type="button" onclick="window.cancelCommentEdit()"
 class="px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
                                                <button type="submit" ${editLoading ? 'disabled' : ''}
 class="bg-slate-950 text-white px-8 py-2.5 rounded-xl font-black uppercase text-sm tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-50">
                                                    ${editLoading ? 'Saving…' : 'Save'}
                                                </button>
                                            </div>
                                        </form>
                                        ` : `
 <div class="${cardBase} border ${cardBorder} text-sm leading-relaxed prose max-w-none ${folded ? 'relative max-h-72 overflow-hidden' : ''}">
                                            ${window.safeMarkdown(c.body)}
                                            ${folded ? `<div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t ${isRoot ? 'from-white' : 'from-[#eef2f8]'} to-transparent pointer-events-none"></div>` : ''}
                                        </div>
                                        ${isLongComment(c.body) ? `
                                        <button type="button" onclick="window.toggleCommentExpand(${c.id})"
 class="inline-flex items-center gap-1.5 text-sm font-black uppercase tracking-wide text-blue-600 hover:text-blue-800 transition-all">
 <i data-lucide="${folded ? 'chevrons-down' : 'chevrons-up'}" class="w-4 h-4"></i>
                                            ${folded ? `Show full comment (${words.toLocaleString()} words)` : 'Show less'}
                                        </button>` : ''}`}
                                        ${replying ? `
 <form onsubmit="event.preventDefault(); window.postComment(this)" data-parent-id="${c.id}" class="space-y-3 pt-1">
                                            <textarea id="reply-input-${c.id}" name="comment" required placeholder="Reply to ${escapeHtml(cName)}…" maxlength="20000"
 class="w-full bg-white/80 p-5 rounded-2xl min-h-[110px] font-medium outline-none border-2 border-slate-100 focus:border-blue-600 transition-all text-slate-900 shadow-sm resize-none"></textarea>
 <div class="flex justify-end gap-3">
                                                <button type="button" onclick="window.cancelReply()"
 class="px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
                                                <button type="submit" ${replyLoading ? 'disabled' : ''}
 class="bg-slate-950 text-white px-8 py-2.5 rounded-xl font-black uppercase text-sm tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-50">
                                                    ${replyLoading ? 'Posting…' : 'Reply'}
                                                </button>
                                            </div>
                                        </form>
                                        ` : ''}
                                        ${kids.length ? `
                                        <button onclick="window.toggleThread(${c.id})"
 class="inline-flex items-center gap-1.5 text-sm font-black uppercase tracking-wide text-blue-600 hover:text-blue-800 transition-all">
 <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" class="w-4 h-4"></i>
                                            ${isCollapsed
                                                ? `Show ${descendants} ${descendants === 1 ? 'reply' : 'replies'}`
                                                : `Hide ${descendants === 1 ? 'reply' : 'replies'}`}
                                        </button>
                                        ` : ''}
                                    </div>
                                </div>
                                ${kids.length && !isCollapsed ? `
 <div class="${canIndent ? 'ml-6 sm:ml-14 pl-4 sm:pl-6' : 'pl-4'} border-l-2 border-blue-200 space-y-6">
                                    ${kids.map(k => renderCommentNode(k, ctx, depth + 1)).join('')}
                                </div>` : ''}
                            </div>`;
}

function renderCommentThread(state, isEditor, isAdmin) {
    const comments = state.comments || [];
    if (!comments.length) return `
 <div class="p-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
 <p class="text-slate-400 font-bold uppercase tracking-widest text-sm">No comments yet.</p>
                                </div>`;
    const byId = new Map(comments.map(c => [c.id, c]));
    const childrenOf = new Map();
    const roots = [];
    for (const c of comments) {
        const pid = c.parent_id;
        // A reply nests under its parent; a top-level comment (or an orphan whose
        // parent is hidden from this viewer) renders at the root.
        if (pid != null && byId.has(pid)) {
            if (!childrenOf.has(pid)) childrenOf.set(pid, []);
            childrenOf.get(pid).push(c);
        } else {
            roots.push(c);
        }
    }
    // Filter by topic: a thread shows if any comment in it is about the topic.
    const filter = state.commentFilter || 'all';
    const threadHas = (id, pred) => {
        const c = byId.get(id);
        return pred(c) || (childrenOf.get(id) || []).some(k => threadHas(k.id, pred));
    };
    const matches = filter === 'all' ? () => true
        : filter === 'general' ? (c) => !c.about
        : (c) => c.about === filter;
    let shown = roots.filter(r => threadHas(r.id, matches));
    // Sort: oldest first (default, the conversation's order), newest first, or busiest thread first.
    const sort = state.commentSort || 'oldest';
    const size = (r) => countDescendants(r.id, childrenOf);
    if (sort === 'newest') shown = shown.slice().reverse();
    else if (sort === 'replies') shown = shown.slice().sort((a, b) => size(b) - size(a));
    if (!shown.length) return `
 <div class="p-10 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
 <p class="text-slate-400 font-bold text-sm">No comments about this part yet.</p>
 <button type="button" onclick="window.setCommentFilter('all')" class="mt-3 text-sm font-black uppercase tracking-wide text-blue-600 hover:text-blue-800">Show all comments</button>
                                </div>`;
    const ctx = { byId, childrenOf, state, isEditor, isAdmin, proposal: state.currentProposal };
    return shown.map(c => renderCommentNode(c, ctx, 0)).join('');
}

// Header of the discussion: who took part, controls to sort and filter, and an
// index of the threads so a reader can see the shape of the conversation
// before reading any of it.
// Editors: untagged comments can be classified; each suggestion is reviewed
// (topic, confidence, evidence) and accepted one by one or all at once.
function renderTopicReview(state, p) {
    const comments = state.comments || [];
    const untagged = comments.filter(c => !c.about).length;
    const canReview = state.user?.is_editor || state.user?.is_admin;
    if (!canReview || !untagged) return '';
    const ts = state.topicSuggestions;
    const isCIS = p.type === 'CIS';
    if (!ts) return `
 <div class="flex items-center justify-between gap-4 flex-wrap rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
 <p class="text-sm text-amber-900"><span class="font-black">${untagged} comment${untagged === 1 ? '' : 's'}</span> ${untagged === 1 ? 'has' : 'have'} no topic yet. The portal can suggest what each one is about, for you to accept.</p>
            <button type="button" onclick="window.loadTopicSuggestions()" class="text-sm font-black uppercase tracking-wide text-amber-800 hover:text-amber-950 whitespace-nowrap">Suggest topics</button>
        </div>`;
    if (ts.loading) return `<div class="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-900">Reading ${untagged} comment${untagged === 1 ? '' : 's'}…</div>`;
    const byId = new Map(comments.map(c => [c.id, c]));
    const items = ts.items.filter(x => byId.has(x.comment_id));
    const noSignal = ts.untagged - items.length;
    return `
 <div class="rounded-2xl bg-amber-50 border border-amber-200 p-5 space-y-4">
 <div class="flex items-center justify-between gap-4 flex-wrap">
 <p class="text-sm text-amber-900"><span class="font-black">${items.length} suggestion${items.length === 1 ? '' : 's'}</span>${noSignal > 0 ? ` · ${noSignal} comment${noSignal === 1 ? '' : 's'} stay${noSignal === 1 ? 's' : ''} general (nothing distinctive to go on)` : ''}</p>
 <div class="flex items-center gap-3">
                ${items.length ? `<button type="button" onclick="window.acceptAllTopicSuggestions()" class="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-black uppercase tracking-wide">Accept all</button>` : ''}
                <button type="button" onclick="window.dismissTopicSuggestions()" class="text-sm font-black uppercase tracking-wide text-amber-800 hover:text-amber-950">Close</button>
            </div>
        </div>
        ${items.length ? `<ul class="divide-y divide-amber-200/70">${items.map(x => {
            const c = byId.get(x.comment_id);
            const name = c.author_display_name || shortAddress(c.author_stake_address);
            const snippet = (c.body || '').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
            return `<li class="py-3 flex items-start gap-3 flex-wrap sm:flex-nowrap">
 <div class="min-w-0 flex-1">
 <p class="text-sm"><span class="font-bold text-slate-900">${escapeHtml(name)}</span> <button type="button" onclick="window.scrollToId('comment-${c.id}')" class="text-slate-400 hover:text-blue-600">· view</button></p>
 <p class="text-sm text-slate-600 truncate">${escapeHtml(snippet)}${(c.body || '').length > 120 ? '…' : ''}</p>
 <p class="text-sm text-slate-400 mt-0.5">${escapeHtml(x.evidence)}</p>
                </div>
 <div class="flex items-center gap-2 flex-shrink-0">
 <span class="text-sm font-bold px-2.5 py-0.5 rounded-full bg-white text-amber-800 border border-amber-200">${escapeHtml(aboutLabel(x.about, isCIS))}</span>
 <span class="text-sm ${x.confidence === 'high' ? 'text-green-700' : 'text-slate-400'}">${x.confidence}</span>
                    <button type="button" onclick="window.applyCommentTopic(${c.id}, '${x.about}')" class="px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-sm font-black uppercase tracking-wide text-amber-900">Accept</button>
                </div>
            </li>`;
        }).join('')}</ul>` : `<p class="text-sm text-amber-900">Nothing distinctive enough to suggest. Authors can set a topic when editing their comment.</p>`}
    </div>`;
}

function renderDiscussionHeader(state, p) {
    const comments = state.comments || [];
    const n = comments.length;
    const isCIS = p.type === 'CIS';
    const people = new Set(comments.map(c => c.author_stake_address)).size;
    const last = n ? new Date(Math.max(...comments.map(c => new Date(c.created_at).getTime()))) : null;
    const counts = commentCountsByAbout(comments);
    const topics = Object.keys(counts).filter(k => k).sort();
    const filter = state.commentFilter || 'all';
    const sort = state.commentSort || 'oldest';
    // The index follows the active filter: a thread is listed if any comment in it matches.
    const kidsOf = (id) => comments.filter(c => c.parent_id === id);
    const threadMatches = (c) => filter === 'all' ? true
        : (filter === 'general' ? !c.about : c.about === filter) || kidsOf(c.id).some(threadMatches);
    const roots = comments.filter(c => c.parent_id == null && threadMatches(c));
    const replies = (id) => kidsOf(id).length;
    const sel = (v, cur) => v === cur ? 'selected' : '';
    const anyCollapsed = state.collapsedComments instanceof Set && state.collapsedComments.size > 0;
    return `
 <div class="flex items-center justify-between px-4 flex-wrap gap-3">
 <h2 class="text-sm font-black uppercase tracking-[0.4em] text-slate-400">Discussion</h2>
 <span class="text-sm font-black text-blue-600 uppercase tracking-widest">${n} ${n === 1 ? 'Comment' : 'Comments'}${people ? ` · ${people} ${people === 1 ? 'participant' : 'participants'}` : ''}${last ? ` · last ${last.toLocaleDateString()}` : ''}</span>
        </div>
        ${renderTopicReview(state, p)}
        ${n ? `
 <div class="bg-white/80 rounded-[2rem] border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5">
 <div class="flex flex-wrap items-center gap-3">
 <label class="text-sm font-black uppercase tracking-widest text-slate-400">Show</label>
 <select onchange="window.setCommentFilter(this.value)" class="text-sm font-bold rounded-xl border-2 border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500">
 <option value="all" ${sel('all', filter)}>All comments (${n})</option>
 ${counts[''] ? `<option value="general" ${sel('general', filter)}>General (${counts['']})</option>` : ''}
                    ${topics.map(t => `<option value="${t}" ${sel(t, filter)}>About ${escapeHtml(aboutLabel(t, isCIS))} (${counts[t]})</option>`).join('')}
                </select>
 <label class="text-sm font-black uppercase tracking-widest text-slate-400 ml-2">Order</label>
 <select onchange="window.setCommentSort(this.value)" class="text-sm font-bold rounded-xl border-2 border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500">
 <option value="oldest" ${sel('oldest', sort)}>Oldest first</option>
 <option value="newest" ${sel('newest', sort)}>Newest first</option>
 <option value="replies" ${sel('replies', sort)}>Most replies</option>
                </select>
                <button type="button" onclick="window.setAllThreads(${anyCollapsed ? 'false' : 'true'})"
 class="ml-auto text-sm font-black uppercase tracking-wide text-blue-600 hover:text-blue-800">${anyCollapsed ? 'Expand all threads' : 'Collapse all threads'}</button>
            </div>
            ${roots.length > 1 ? `
            <div>
 <p class="text-sm font-black uppercase tracking-widest text-slate-400 mb-2">Threads${filter !== 'all' ? ` about ${escapeHtml(aboutLabel(filter === 'general' ? null : filter, isCIS))}` : ''}</p>
 <ol class="divide-y divide-slate-100">
                ${roots.map((c, i) => {
                    const name = c.author_display_name || shortAddress(c.author_stake_address);
                    const snippet = (c.body || '').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 110);
                    const r = replies(c.id);
                    return `<li>
 <button type="button" onclick="window.scrollToId('comment-${c.id}')" class="w-full text-left flex items-start gap-3 py-2 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
 <span class="text-sm font-black text-slate-300 w-5 flex-shrink-0 pt-0.5">${i + 1}</span>
 <span class="min-w-0 flex-1">
 <span class="text-sm font-bold text-slate-900">${escapeHtml(name)}</span>
 ${c.about ? `<span class="text-sm text-amber-700 ml-2">· ${escapeHtml(aboutLabel(c.about, isCIS))}</span>` : ''}
 <span class="text-sm text-slate-400 ml-2">${new Date(c.created_at).toLocaleDateString()}</span>
 <span class="block text-sm text-slate-500 truncate">${escapeHtml(snippet)}${(c.body || '').length > 110 ? '…' : ''}</span>
                        </span>
 ${r ? `<span class="text-sm font-bold text-slate-400 flex-shrink-0 flex items-center gap-1 pt-0.5"><i data-lucide="corner-down-right" class="w-3.5 h-3.5"></i>${r}</span>` : ''}
                    </button></li>`;
                }).join('')}
                </ol>
            </div>` : ''}
        </div>` : ''}`;
}

const SUGGESTION_LABELS = {
    title: 'Title', abstract: 'Summary', motivation: 'Why is this change needed?',
    analysis: 'Analysis & Test', impact: 'Impact', exhibits: 'Links & Files',
};

const SUGGERABLE_FIELDS = ['title', 'abstract', 'motivation', 'analysis', 'impact', 'exhibits'];

// Human label for a suggestion's field, including revision-text paths like
// "revisions[0].proposed" -> "Revision 1 · Proposed".
function labelForSuggestionField(field) {
    if (SUGGESTION_LABELS[field]) return SUGGESTION_LABELS[field];
    const m = /^revisions\[(\d+)\]\.(proposed|original|insert_after)$/.exec(field || '');
    if (m) {
        const sub = { proposed: 'Proposed', original: 'Original', insert_after: 'Insert-after' }[m[2]];
        return `Revision ${Number(m[1]) + 1} · ${sub}`;
    }
    return field;
}

function renderSuggestions(state, p, isAuthor, isEditor) {
    const edits = state.suggestedEdits || [];
    const pending = edits.filter(e => e.status === 'pending');
    const resolved = edits.filter(e => e.status !== 'pending');
    const canSuggest = isEditor && !isAuthor;

    if (!canSuggest && !isAuthor && !edits.length) return '';

    const pendingCards = pending.map(e => `
 <div class="bg-white/80 rounded-2xl border-2 border-blue-100 p-6 space-y-4">
 <div class="flex items-start justify-between gap-4">
            <div>
 <span class="text-sm font-black uppercase tracking-widest text-blue-500">Full edit suggested</span>
 <p class="text-sm text-slate-500 mt-0.5">
 by <span class="font-bold text-slate-700 ">${escapeHtml(e.editor_display_name || shortAddress(e.editor_stake_address))}</span>
 <span class="text-slate-400 font-mono">(${shortAddress(e.editor_stake_address)})</span>
                </p>
            </div>
 <span class="flex-shrink-0 px-2.5 py-1 rounded-full text-sm font-black uppercase tracking-widest bg-amber-100 text-amber-700 ">Pending</span>
        </div>
        ${e.note ? `<p class="text-sm text-slate-500 italic">"${escapeHtml(e.note)}"</p>` : ''}
 <div class="flex flex-wrap gap-3 pt-1">
            <button onclick="window.previewSuggestedEdit(${e.id})"
 class="flex items-center gap-2 px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-black uppercase tracking-widest rounded-xl transition-all">
 <i data-lucide="eye" class="w-3.5 h-3.5"></i> Preview proposed version
            </button>
            ${isAuthor ? `
            <button onclick="window.approveSuggestedEdit(${e.id})"
 class="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all">
 <i data-lucide="check" class="w-3.5 h-3.5"></i> Approve
            </button>
            <button onclick="window.rejectSuggestedEdit(${e.id})"
 class="flex items-center gap-2 px-5 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 text-sm font-black uppercase tracking-widest rounded-xl transition-all">
 <i data-lucide="x" class="w-3.5 h-3.5"></i> Reject
            </button>` : ''}
        </div>
    </div>`).join('');

    const resolvedCards = resolved.map(e => `
 <div class="rounded-2xl border border-slate-100 p-5 opacity-60 flex items-center justify-between gap-3">
 <span class="text-sm font-black uppercase tracking-widest text-slate-400">Full edit by ${escapeHtml(e.editor_display_name || shortAddress(e.editor_stake_address))}</span>
 <span class="px-2.5 py-1 rounded-full text-sm font-black uppercase tracking-widest ${e.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">${e.status}</span>
    </div>`).join('');

    const suggestButtons = canSuggest ? `
 <div class="px-1">
        <button onclick="window.openSuggestEdit(${p.number})"
 class="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black uppercase tracking-widest transition-all">
 <i data-lucide="edit-3" class="w-4 h-4"></i> Suggest edits
        </button>
 <p class="text-sm text-slate-400 mt-2">Open the editor to propose a full edited version for the author to approve or refuse.</p>
    </div>` : '';

    return `
 <section class="space-y-6 pt-16 border-t border-slate-100 ">
 <div class="px-4">
 <div class="flex items-center justify-between">
 <h2 class="text-sm font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-2">
 <i data-lucide="git-pull-request" class="w-3.5 h-3.5"></i> Suggested Changes
                </h2>
 ${pending.length ? `<span class="text-sm font-black text-amber-600 uppercase tracking-widest">${pending.length} pending</span>` : ''}
            </div>
 <p class="text-sm text-slate-400 mt-2">Editors can propose a full edited version here for the author to approve or refuse.</p>
        </div>
        ${suggestButtons}
 ${pending.length ? `<div class="space-y-4">${pendingCards}</div>` : `
 <div class="mx-1 py-10 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
 <i data-lucide="git-pull-request" class="w-8 h-8 mx-auto mb-3 text-slate-300"></i>
 <p class="text-sm font-bold text-slate-400">No suggested edits yet.</p>
        </div>`}
        ${resolved.length ? `
 <details class="px-1">
 <summary class="text-sm font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">Show ${resolved.length} resolved</summary>
 <div class="mt-3 space-y-2">${resolvedCards}</div>
        </details>` : ''}
    </section>`;
}

export function renderDetail(state) {
    const p = state.currentProposal;
    if (!p || state.loading?.detail) {
        return `
 <div class="flex items-center justify-center py-40">
 <div class="flex flex-col items-center gap-6">
 <div class="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
 <p class="text-slate-400 font-bold uppercase tracking-widest text-sm">Loading proposal...</p>
                </div>
            </div>`;
    }

    const myStake = state.user?.stake_address;
    const isAuthor = myStake && myStake === p.author_stake_address;
    const isEditor = state.user?.is_editor === true;
    const isAdmin = state.user?.is_admin === true;

    const authorName = p.author_display_name || shortAddress(p.author_stake_address);
    const authorAddr = shortAddress(p.author_stake_address);
    const createdDate = new Date(p.created_at);
    // Recommended review period runs from submission for the category's
    // consultation length (mirrors the wizard's dayMap). CIS default to 30 days.
    const CONSULT_DAYS = { Procedural: 60, Substantive: 60, Technical: 90, Interpretive: 30, Editorial: 14, Other: 30 };
    const catName = (p.labels || []).map(l => l.name).find(n => CONSULT_DAYS[n]);
    const consultDays = p.type === 'CIS' ? 30 : (CONSULT_DAYS[catName] || 30);
    const expiryDate = new Date(createdDate.getTime() + consultDays * 24 * 60 * 60 * 1000);

    window.toggleEventExpansion = (id) => {
        state.expandedEventId = state.expandedEventId == id ? null : id;
        window.updateUI?.(true);
    };
    window.toggleAuditTrail = () => {
        state.auditTrailExpanded = !state.auditTrailExpanded;
        window.updateUI?.(true);
    };
    window.toggleAuditPanel = () => {
        state.auditPanelExpanded = !state.auditPanelExpanded;
        window.updateUI?.(true);
    };
    window.toggleVersionHistory = () => {
        state.versionHistoryExpanded = !state.versionHistoryExpanded;
        window.updateUI?.(true);
    };
    window.toggleAuthorControls = () => {
        state.authorControlsExpanded = !state.authorControlsExpanded;
        window.updateUI?.(true);
    };
    window.toggleEditorControls = () => {
        state.editorControlsExpanded = !state.editorControlsExpanded;
        window.updateUI?.(true);
    };
    if (window.detailTimerInterval) clearInterval(window.detailTimerInterval);

    const LIFECYCLE = ['consultation', 'ready', 'done', 'withdrawn'];
    const nonLifecycle = (p.labels || []).filter(l => !LIFECYCLE.includes(l.name.toLowerCase()));

    const versions = state.proposalVersions || [];

    return `
 <div class="max-w-7xl mx-auto pb-20 fade-in text-left">
 <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12">
 <button onclick="window.setView('list')" class="group flex items-center gap-2 text-on-surface-variant hover:text-brand-primary transition-colors font-bold uppercase text-sm tracking-widest">
 <i data-lucide="arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition-transform"></i>
                    Back to Proposals
                </button>
 <div class="flex items-center gap-2 flex-wrap">
                    ${versions.length ? `
                    <button onclick="window.toggleVersionHistory()"
 class="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/80 border border-slate-200 text-sm font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-all">
 <i data-lucide="history" class="w-4 h-4"></i> Version history
 <span class="text-sm font-black text-blue-600">${versions.length}</span>
                    </button>` : ''}
                    <button onclick="window.toggleAuditPanel()"
 class="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/80 border border-slate-200 text-sm font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-all">
 <i data-lucide="scroll-text" class="w-4 h-4"></i> Audit trail
                    </button>
 <span class="text-sm font-black text-on-surface-variant uppercase tracking-widest ml-2">#${p.number}</span>
                </div>
            </div>

            <!-- Full-width header: tags, title, meta -->
 <header class="space-y-8 mb-16">
 <div class="flex flex-wrap gap-3">
 <span class="px-5 py-2 rounded-full text-sm font-black uppercase tracking-widest bg-white/15 text-on-surface border border-white/20">${p.type}</span>
                    ${(p.labels || []).filter(l => l.name !== p.type).map(l => `
 <span class="px-5 py-2 rounded-full text-sm font-black uppercase tracking-widest bg-white/15 text-on-surface border border-white/20">
                            ${escapeHtml(l.name)}
                        </span>
                    `).join('')}
                    ${p.state === 'closed' ? `
 <span class="px-5 py-2 rounded-full text-sm font-black uppercase tracking-widest bg-on-surface text-surface ">Closed</span>
                    ` : ''}
                </div>

 <h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-on-surface leading-[1.1]">
                    ${escapeHtml(p.title)}
                </h1>

 <div class="flex flex-wrap items-center gap-8 text-on-surface-variant font-medium border-b border-white/15 pb-10">
 <div class="flex items-center gap-3">
 <div class="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
 <i data-lucide="user" class="w-4 h-4 text-on-surface"></i>
                        </div>
 <div class="flex flex-col">
 <span class="text-sm font-black uppercase text-on-surface-variant tracking-widest leading-none mb-1">Author</span>
 <span class="text-sm font-bold text-on-surface ">${escapeHtml(authorName)}</span>
 <span class="text-sm text-on-surface-variant font-mono">(${authorAddr})</span>
                        </div>
                    </div>
                    ${(p.co_authors && p.co_authors.length) ? `
 <div class="w-px h-8 bg-white/15 "></div>
 <div class="flex flex-col">
 <span class="text-sm font-black uppercase text-on-surface-variant tracking-widest leading-none mb-1">Co-author${p.co_authors.length > 1 ? 's' : ''}</span>
 <span class="text-sm font-bold text-on-surface ">${p.co_authors.map(ca => escapeHtml(ca.display_name || shortAddress(ca.stake_address))).join(', ')}</span>
                    </div>` : ''}
 <div class="w-px h-8 bg-white/15 "></div>
 <div class="flex flex-col">
 <span class="text-sm font-black uppercase text-on-surface-variant tracking-widest leading-none mb-1">Submitted</span>
 <span class="text-sm font-bold text-on-surface ">${createdDate.toLocaleDateString()}</span>
                    </div>
 <div class="w-px h-8 bg-white/15 "></div>
 <div class="flex flex-col">
 <span class="text-sm font-black uppercase text-on-surface-variant tracking-widest leading-none mb-1">Recommended review period ends</span>
 <span class="text-sm font-bold text-on-surface ">${expiryDate.toLocaleDateString()}</span>
                    </div>
                </div>
            </header>

            <!-- Lifecycle stepper + contextual actions -->
            ${renderLifecycleStepper(p, state, isAuthor, isEditor)}

            <!-- Author / moderation actions -->
            ${renderActionRow(p, state, isAuthor, isEditor, isAdmin)}

            <!-- Editor tools (status tags, signal, withdraw override) -->
            ${isEditor ? renderEditorControls(p, state) : ''}

 <div class="mt-10">
                <!-- Main Body. The jump bar is a child of this tall column so its
                     sticky positioning lasts for the whole proposal and discussion. -->
 <div class="space-y-16">
                    ${renderJumpBar(p, (state.comments || []).length)}
                    <!-- Proposal Body -->
 <article class="bg-white/80 p-10 sm:p-20 rounded-[4rem] border border-slate-100 shadow-sm prose max-w-none text-left leading-relaxed">
                        ${p.structured ? renderStructuredBody(p.structured, p.type, commentCountsByAbout(state.comments)) : window.safeMarkdown(stripFrontmatter(p.body) || '*No content.*')}
                    </article>

                    ${(p.structured?.revisions?.length && p.structured.revisions.some(revisionHasEffect)) ? `
 <div class="bg-blue-50/60 border border-blue-100 rounded-[3rem] p-8 flex items-center justify-between gap-6">
 <div class="flex items-center gap-4">
 <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
 <i data-lucide="git-diff" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
 <p class="text-sm font-black text-slate-900 ">Proposed Constitution Draft</p>
 <p class="text-sm text-slate-500 mt-0.5">${countEffectiveRevisions(p.structured.revisions)} change${countEffectiveRevisions(p.structured.revisions) !== 1 ? 's' : ''} — view side-by-side diff against current</p>
                            </div>
                        </div>
                        <button onclick="window.viewProposalDiff(${p.number})"
 class="flex-shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl text-sm font-black transition-all hover:-translate-y-0.5 shadow-lg">
 <i data-lucide="columns-2" class="w-4 h-4"></i>
                            View Diff
                        </button>
                    </div>
                    ` : ''}

                    <!-- Suggestions -->
                    ${renderSuggestions(state, p, isAuthor, isEditor)}

                    <!-- Comments -->
 <section id="discussion" class="space-y-12 pt-16 border-t border-slate-100 scroll-mt-40">
                        ${renderDiscussionHeader(state, p)}

 <div class="space-y-8">
                            ${renderCommentThread(state, isEditor, isAdmin)}

                            ${!state.user ? `
 <div class="pt-8 pl-0 sm:pl-20">
 <div class="bg-white/80 p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <p class="text-sm text-slate-500 font-bold">Have a wallet? Connect to join the discussion.</p>
                                    <button onclick="window.loginWithWallet()"
 class="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-950 text-white rounded-xl text-sm font-black hover:opacity-90 transition-all flex-shrink-0">
 <i data-lucide="wallet" class="w-3.5 h-3.5"></i> Connect Wallet
                                    </button>
                                </div>
                            </div>
                            ` : `
 <div id="comment-form" class="pt-8 pl-0 sm:pl-20 scroll-mt-40">
 <form onsubmit="event.preventDefault(); window.postComment(this)" class="space-y-6">
 <div class="flex flex-wrap items-center gap-3 px-4">
 <label class="text-sm font-black uppercase tracking-widest text-slate-400">This comment is about</label>
 <select name="about" class="text-sm font-bold rounded-xl border-2 border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500 max-w-full">
                                            ${aboutOptions(p.structured, p.type).map(o => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <textarea name="comment" required placeholder="Share your thoughts…" maxlength="20000"
                                        oninput="window._cc(this, 'cc-comment')"
 class="w-full bg-white/80 p-10 rounded-[3rem] min-h-[200px] font-medium text-lg outline-none border-2 border-slate-100 focus:border-blue-600 transition-all text-slate-900 shadow-sm resize-none"></textarea>
 <p class="text-sm text-slate-400 text-right -mt-4"><span id="cc-comment">0</span> / 20,000 characters</p>
 <div class="flex justify-end">
                                        <button type="submit" ${state.loading?.postComment ? 'disabled' : ''}
 class="bg-slate-950 text-white px-14 py-6 rounded-3xl font-black uppercase text-sm tracking-[0.3em] hover:-translate-y-1 active:scale-95 transition-all shadow-2xl disabled:opacity-50">
                                            ${state.loading?.postComment ? 'Posting…' : 'Post Comment'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                            `}
                        </div>
                    </section>

                </div>
            </div>
        </div>`;
}

// Rendered by updateUI at the app root — NOT inside the page container, whose
// fade-in transform would turn position:fixed into page-anchored positioning.
export function renderDetailOverlays(state) {
    const p = state.currentProposal;
    if (!p) return '';
    return (state.versionHistoryExpanded ? renderDetailModal('Version history', 'toggleVersionHistory', renderVersionList(state, p)) : '')
         + (state.auditPanelExpanded ? renderDetailModal('Audit trail', 'toggleAuditPanel', renderAuditTrail(state)) : '');
}

// Full-screen overlay used for the version-history and audit-trail popups.
function renderDetailModal(title, closeFn, body) {
    return `
 <div onclick="if (event.target === this) window.${closeFn}()"
 class="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 sm:p-8">
 <div class="bg-white w-full max-w-2xl max-h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden">
 <div class="flex items-center justify-between px-8 py-5 border-b border-slate-100 flex-shrink-0">
 <h3 class="text-xl font-black tracking-tight text-slate-900">${title}</h3>
                <button onclick="window.${closeFn}()"
 class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
 <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
 <div class="p-8 overflow-y-auto">${body}</div>
        </div>
    </div>`;
}

function renderVersionList(state, p) {
    const versions = state.proposalVersions || [];
    if (!versions.length) return `<p class="text-sm text-slate-400 italic">No versions yet.</p>`;
    return `
 <div class="space-y-2">
        ${versions.map((v, i) => {
            const isCurrent = i === 0;
            const when = new Date(v.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
            return `
            <button onclick="window.openVersionModal(${p.number}, ${v.version})"
 class="w-full text-left flex items-center gap-4 px-4 py-3 rounded-2xl transition-all
                    ${isCurrent ? 'bg-blue-50 border border-blue-100 ' : 'hover:bg-slate-50 border border-transparent'}">
 <span class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black
                    ${isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 '}">
                    V${v.version}
                </span>
 <div class="min-w-0 flex-1">
 <p class="text-sm font-bold text-slate-900 truncate">${escapeHtml(v.change_summary || 'Update')}</p>
 <p class="text-sm text-slate-400 mt-0.5">${when} · ${escapeHtml(v.created_by_name || shortAddress(v.created_by))}</p>
 ${v.content_hash ? `<p class="text-sm text-slate-300 font-mono mt-1 truncate" title="${v.content_hash}">${v.content_hash.slice(0, 16)}…</p>` : ''}
                </div>
 ${isCurrent ? `<span class="flex-shrink-0 text-sm font-black uppercase tracking-widest text-blue-500">Current</span>` : `<i data-lucide="eye" class="w-3.5 h-3.5 text-slate-300 flex-shrink-0"></i>`}
            </button>`;
        }).join('')}
    </div>
 <p class="text-sm text-slate-400 mt-4">Click a version to view its full text.</p>`;
}

function renderAuditTrail(state) {
    const events = state.auditEvents || [];
    const LIMIT = 5;
    const isExpanded = state.auditTrailExpanded;
    const visible = isExpanded ? events : events.slice(0, LIMIT);
    const hasMore = events.length > LIMIT;

    if (events.length === 0) {
 return `<p class="text-sm text-slate-400 italic">No audit events yet.</p>`;
    }

    return `
 <div class="space-y-5 relative">
 <div class="absolute left-[13px] top-2 bottom-2 w-[2px] bg-slate-100 "></div>
        ${visible.map(ev => {
            const name = ev.actor_display_name || shortAddress(ev.actor_stake_address) || 'Unknown';
            const addr = shortAddress(ev.actor_stake_address);
            const details = getAuditDetails(ev, state);
            const isEvExpanded = state.expandedEventId == ev.id;
            const when = new Date(ev.created_at);
            const whenStr = when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                + ' · ' + when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            return `
 <div class="flex gap-4 relative z-10">
 <div class="w-7 h-7 rounded-lg bg-slate-100 border-2 border-white flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer transition-transform hover:scale-110"
                     onclick="window.toggleEventExpansion('${ev.id}')">
 <i data-lucide="${details.icon}" class="w-3.5 h-3.5 ${details.color}"></i>
                </div>
 <div class="flex-grow min-w-0">
 <div class="flex items-start justify-between gap-2 mb-1.5 cursor-pointer" onclick="window.toggleEventExpansion('${ev.id}')">
 <div class="min-w-0">
 <p class="text-sm font-black text-slate-900 leading-tight">${escapeHtml(details.message)}</p>
 <p class="text-sm text-slate-400 mt-0.5">
 ${escapeHtml(name)}${ev.actor_display_name ? ` <span class="font-mono">(${addr})</span>` : ''}
                            </p>
                        </div>
 <span class="text-sm text-slate-400 font-bold whitespace-nowrap flex-shrink-0">${whenStr}</span>
                    </div>
                    ${details.detail ? `
 <div class="cursor-pointer" onclick="window.toggleEventExpansion('${ev.id}')">
                        ${isEvExpanded ? `
 <div class="mt-1 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-500 leading-relaxed whitespace-pre-wrap font-mono">
                            ${escapeHtml(details.detail)}
                        </div>` : `
 <p class="text-sm text-slate-400 italic truncate">
 <i data-lucide="chevron-right" class="w-2.5 h-2.5 inline-block mr-0.5 align-middle"></i>click to expand
                        </p>`}
                    </div>` : ''}
                </div>
            </div>`;
        }).join('')}
    </div>
    ${hasMore ? `
    <button onclick="window.toggleAuditTrail()"
 class="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-200 text-sm font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all">
 <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
        ${isExpanded ? 'Show less' : `Show all ${events.length} events`}
    </button>` : ''}`;
}

// The proposal's process, visualised: Consultation → Ready → Done. The author's
// advisory "ready" signal and the editor's stage advance live on the stepper
// itself, so it's clear they are part of moving the proposal forward.
function renderLifecycleStepper(p, state, isAuthor, isEditor) {
    const labels = (p.labels || []).map(l => l.name);
    const stage = ['consultation','ready','done','withdrawn'].find(s => labels.includes(s)) || 'consultation';
    const authorReady = labels.includes('author-ready');

    if (stage === 'withdrawn') {
        return `
 <div class="bg-red-50 border border-red-200 rounded-[2rem] px-8 py-5 flex items-center gap-3">
 <i data-lucide="x-circle" class="w-5 h-5 text-red-500 flex-shrink-0"></i>
 <p class="text-sm font-bold text-red-700">This proposal has been withdrawn. It is closed and no longer progresses through the process.</p>
        </div>`;
    }

    const STEPS = [
        { id: 'consultation', label: 'Consultation', desc: 'Open for community discussion' },
        { id: 'ready',        label: 'Ready',        desc: 'Under editor review' },
        { id: 'done',         label: 'Done',         desc: 'Finalised and closed' },
    ];
    const curIdx = STEPS.findIndex(s => s.id === stage);
    const nextStage = curIdx < STEPS.length - 1 ? STEPS[curIdx + 1].id : null;

    // Contextual action attached to the stepper.
    const signalText = stage === 'consultation' ? 'Signal ready for review'
                     : stage === 'ready' ? 'Signal ready for completion'
                     : null;
    let action = '';
    if (isAuthor && signalText) {
        action = authorReady
            ? `<div class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold">
 <i data-lucide="check-circle" class="w-4 h-4"></i> Ready signal active — editors have been signalled
               </div>
               <button onclick="window.authorSignalReady()" class="text-sm font-bold text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors">Retract</button>`
            : `<button onclick="window.authorSignalReady()"
 class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-all">
 <i data-lucide="thumbs-up" class="w-4 h-4"></i> ${signalText}
               </button>
 <span class="text-sm text-slate-400">Tells the editors you consider this proposal ready to move to the next stage. Advisory — editors decide.</span>`;
    } else if (isEditor && nextStage) {
        const nextLabel = STEPS[curIdx + 1].label;
        action = `
            ${authorReady ? `<span class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 border border-green-200 text-sm font-bold text-green-700"><i data-lucide="thumbs-up" class="w-3.5 h-3.5"></i> Author has signalled ready</span>` : ''}
            <button onclick="window.editorSetLifecycle('${nextStage}')"
 class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all">
 <i data-lucide="arrow-right-circle" class="w-4 h-4"></i> Move to ${nextLabel}
            </button>
 <span class="text-sm text-slate-400">Permanently recorded.</span>`;
    }

    return `
 <div class="bg-white/80 rounded-[2rem] border border-slate-100 shadow-sm px-6 sm:px-10 py-6">
 <div class="flex items-center">
            ${STEPS.map((s, i) => `
 <div class="flex flex-col items-center gap-1.5 flex-shrink-0">
 <div class="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${
                    i < curIdx ? 'bg-green-500 text-white' :
                    i === curIdx ? 'bg-blue-600 text-white' :
                    'bg-slate-200 text-slate-400'
                }">
                    ${i < curIdx ? '<i data-lucide="check" class="w-4 h-4"></i>' : i + 1}
                </div>
 <span class="text-sm font-black uppercase tracking-widest ${i === curIdx ? 'text-blue-600' : i < curIdx ? 'text-green-600' : 'text-slate-400'}">${s.label}</span>
 <span class="text-sm text-slate-400 hidden sm:block">${s.desc}</span>
            </div>
 ${i < STEPS.length - 1 ? `<div class="h-0.5 flex-1 mx-3 sm:mx-5 ${i < curIdx ? 'bg-green-500' : 'bg-slate-200'} -mt-10"></div>` : ''}
            `).join('')}
        </div>
        ${action ? `<div class="mt-5 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-3">${action}</div>` : ''}
    </div>`;
}

// Author actions (edit / withdraw) and moderation controls, directly under the
// key-details header where they're easy to find — no more sidebar.
function renderActionRow(p, state, isAuthor, isEditor, isAdmin) {
    const labels = (p.labels || []).map(l => l.name);
    const stage = ['consultation','ready','done','withdrawn'].find(s => labels.includes(s)) || null;
    const isActive = !stage || stage === 'consultation';
    const isLocked = stage === 'ready' || stage === 'done' || stage === 'withdrawn';
    const isRevision = labels.includes('revision');
    const mod = p.moderation_status || 'visible';

    const parts = [];

    if (isAuthor && isRevision) {
        parts.push(`
 <span class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-200 text-sm font-bold text-orange-700">
 <i data-lucide="pencil-line" class="w-4 h-4"></i> Revision requested by an editor
        </span>`);
    }
    if (isAuthor && isActive) {
        parts.push(`
        <button onclick="window.startEdit()"
 class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-50 border border-blue-100 hover:bg-blue-100 text-sm font-bold text-blue-700 transition-all">
 <i data-lucide="edit-3" class="w-4 h-4"></i> Edit proposal
        </button>`);
    }
    if (isAuthor && isLocked && stage !== 'withdrawn') {
        parts.push(`
 <span class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-500">
 <i data-lucide="lock" class="w-4 h-4"></i> Editing locked — past consultation
        </span>`);
    }
    if (isAuthor && stage !== 'withdrawn') {
        parts.push(`
        <button onclick="window.authorWithdraw()"
 class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-sm font-bold text-slate-600 transition-all">
 <i data-lucide="x-circle" class="w-4 h-4"></i> Withdraw proposal
        </button>`);
    }

    // Moderation (editors/admins)
    if (isEditor || isAdmin) {
        if (mod === 'under_review') {
            parts.push(`<span class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-black uppercase tracking-wider"><i data-lucide="eye-off" class="w-4 h-4"></i> Hidden — under review</span>`);
        } else if (mod === 'removed') {
            parts.push(`<span class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-black uppercase tracking-wider"><i data-lucide="ban" class="w-4 h-4"></i> Removed — admins only</span>`);
        } else {
            parts.push(`
            <button onclick="window.flagProposalForRemoval()" title="Hides the proposal and sends it to an admin with your reason. The author is notified."
 class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 text-sm font-bold text-red-600 transition-all">
 <i data-lucide="flag" class="w-4 h-4"></i> Flag for removal
            </button>`);
        }
        if (isAdmin && mod !== 'visible') {
            parts.push(`
            <button onclick="window.setView('moderation')"
 class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-sm font-bold text-slate-600 transition-all">
 <i data-lucide="gavel" class="w-4 h-4"></i> Review in moderation queue
            </button>`);
        }
    }

    if (!parts.length) return '';
    return `<div class="mt-6 flex flex-wrap items-center gap-3">${parts.join('')}</div>`;
}

function renderEditorControls(p, state) {
    const labels = (p.labels || []).map(l => l.name);
    // Lifecycle advancement lives on the stepper; this panel holds the rest.
    const STATUS_TAGS = ['review','revision','finalizing','onchain'];
    const SIGNAL_TAGS = {
        'editor-ok':       { color: 'green',  icon: 'check-circle', label: 'OK' },
        'editor-concern':  { color: 'red',    icon: 'alert-circle',  label: 'Concern' },
    };
    const currentSignal = Object.keys(SIGNAL_TAGS).find(s => labels.includes(s)) || null;

    const expanded = state.editorControlsExpanded;
    return `
 <div class="mt-6 bg-white/80 p-6 sm:p-8 rounded-[2rem] border-2 border-amber-100 shadow-sm">
 <button onclick="window.toggleEditorControls()" class="w-full flex items-center justify-between">
 <h3 class="text-sm font-black uppercase tracking-[0.2em] text-amber-600 flex items-center gap-2">
 <i data-lucide="shield" class="w-3.5 h-3.5"></i> Editor Controls
            </h3>
 <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-amber-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}"></i>
        </button>

 ${expanded ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <!-- Status Tags -->
 <div class="space-y-3">
 <p class="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Status Tags</p>
 <div class="flex flex-wrap gap-2">
                ${STATUS_TAGS.map(tag => {
                    const active = labels.includes(tag);
                    return `<button onclick="window.editorToggleStatusTag('${tag}')"
 class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all ${
                            active ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-400'
                        }">
                        ${tag}
                    </button>`;
                }).join('')}
            </div>
        </div>

        <!-- Editor Signal -->
 <div class="space-y-3">
 <p class="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Editor Signal</p>
 <div class="flex flex-col gap-2">
                ${Object.entries(SIGNAL_TAGS).map(([tag, cfg]) => {
                    const active = currentSignal === tag;
                    return `<button onclick="window.editorToggleSignal('${tag}')"
 class="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all ${
                            active ? `bg-${cfg.color}-600 text-white border-${cfg.color}-600` : `bg-slate-50 text-slate-600 border-slate-200 hover:border-${cfg.color}-400`
                        }">
 <i data-lucide="${cfg.icon}" class="w-3.5 h-3.5 flex-shrink-0"></i>
                        ${cfg.label}
                    </button>`;
                }).join('')}
            </div>
        </div>

        <!-- Withdraw override (two-person rule for editors) -->
        ${renderEditorWithdraw(p, state, labels)}
        </div>` : ''}
    </div>`;
}

function renderEditorWithdraw(p, state, labels) {
    if (labels.includes('withdrawn')) return '';

    const myStake = state.user?.stake_address;
    const isAuthor = myStake && myStake === p.author_stake_address;
    // The author withdraws via their own panel (direct, no second editor needed).
    if (isAuthor) return '';

    const pendingBy = p.withdrawal_requested_by;
    const pendingByName = p.withdrawal_requested_by_name;
    const pendingByMe = pendingBy && pendingBy === myStake;

    const cancelBtn = `
        <button onclick="window.editorCancelWithdraw()"
 class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-500 text-sm font-black uppercase tracking-wider hover:bg-slate-50 transition-all">
 <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            Cancel withdrawal request
        </button>`;

    let inner;
    if (!pendingBy) {
        // No request yet — this editor opens one.
        inner = `
            <button onclick="window.editorWithdraw()"
 class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm font-black uppercase tracking-wider hover:bg-red-100 transition-all">
 <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                Request Withdrawal
            </button>
 <p class="text-sm text-slate-400 text-center mt-2">A second, different editor must confirm before this takes effect.</p>`;
    } else if (pendingByMe) {
        // This editor already requested — they cannot self-confirm.
        inner = `
 <div class="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm font-bold text-amber-700 mb-2">
 <i data-lucide="clock" class="w-3.5 h-3.5 flex-shrink-0 mt-px"></i>
                <span>You requested withdrawal. Awaiting confirmation from another editor — you cannot confirm your own request.</span>
            </div>
            ${cancelBtn}`;
    } else {
        // A different editor requested — this editor can confirm.
        const who = escapeHtml(pendingByName || shortAddress(pendingBy));
        inner = `
 <div class="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm font-bold text-amber-700 mb-2">
 <i data-lucide="clock" class="w-3.5 h-3.5 flex-shrink-0 mt-px"></i>
                <span>Withdrawal requested by ${who}. Confirm to finalise.</span>
            </div>
            <button onclick="window.editorWithdraw()"
 class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-600 border border-red-600 text-white text-sm font-black uppercase tracking-wider hover:bg-red-700 transition-all mb-2">
 <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                Confirm Withdrawal
            </button>
            ${cancelBtn}`;
    }

    return `
 <div class="space-y-3">
 <p class="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Withdraw Proposal</p>
            ${inner}
        </div>`;
}

const FIELD_LABELS = {
    title: 'Title', abstract: 'Summary', motivation: 'Why is this change needed?',
    analysis: 'Analysis & Test', impact: 'Impact', exhibits: 'Links & Files',
};

const LABEL_DESCRIPTIONS = {
    consultation: 'Proposal is open for community discussion',
    ready: 'Author has signalled the proposal is ready for editor review',
    done: 'Proposal has been finalised and closed',
    withdrawn: 'Proposal has been withdrawn',
    'author-ready': 'Author marked proposal as ready for review',
    review: 'Editor has taken the proposal into review',
    revision: 'Editor has requested revisions from the author',
    finalizing: 'Proposal is in the finalizing stage',
    onchain: 'Proposal has been submitted on-chain',
    'editor-ok': 'Editor has signalled approval',
    'editor-concern': 'Editor has raised a concern',
    'editor-suggested': 'Editor has made a suggestion',
    major: 'Classified as a major change',
    minor: 'Classified as a minor change',
    bundle: 'Flagged for bundling with other proposals',
    'fast-track': 'Flagged for fast-track consideration',
    pause: 'Proposal has been paused',
    'flagged-for-removal': 'Editor has flagged this proposal for admin review (possible spam or abuse)',
    CAP: 'Type: Constitutional Amendment Proposal',
    CIS: 'Type: Constitutional Interpretation Statement',
};

function getAuditDetails(ev, state) {
    let data = {};
    if (ev.data && typeof ev.data === 'object') data = ev.data;
    else if (ev.data) try { data = JSON.parse(ev.data); } catch {}

    const fieldLabel = data.field ? (FIELD_LABELS[data.field] || data.field) : null;

    switch (ev.event_type) {
        case 'proposal_created':
            return {
                icon: 'plus-circle', color: 'text-blue-600',
                message: 'Proposal submitted',
                detail: data.type ? `Type: ${data.type}` : '',
            };

        case 'proposal_edited': {
            const changes = [];
            if (data.title) changes.push(`Title: "${data.title.from}" → "${data.title.to}"`);
            if (data.body_updated) changes.push('Content updated');
            return {
                icon: 'pencil', color: 'text-blue-500',
                message: 'Proposal edited',
                detail: changes.join('\n') || '',
            };
        }

        case 'label_added': {
            const lbl = data.label || '';
            const desc = LABEL_DESCRIPTIONS[lbl] || '';
            return {
                icon: 'tag', color: 'text-purple-500',
                message: `Label added — ${lbl}`,
                detail: desc,
            };
        }

        case 'label_removed': {
            const lbl = data.label || '';
            return {
                icon: 'tag', color: 'text-slate-400',
                message: `Label removed — ${lbl}`,
                detail: LABEL_DESCRIPTIONS[lbl] || '',
            };
        }

        case 'comment_added': {
            const comment = (state?.comments || []).find(c =>
                c.author_stake_address === ev.actor_stake_address &&
                Math.abs(new Date(c.created_at) - new Date(ev.created_at)) < 5000
            );
            return {
                icon: 'message-circle', color: 'text-slate-500',
                message: 'Comment posted',
                detail: comment ? comment.body.slice(0, 200) + (comment.body.length > 200 ? '…' : '') : '',
            };
        }

        case 'suggestion_created': {
            const suggestion = (state?.suggestions || []).find(s =>
                s.editor_stake_address === ev.actor_stake_address && s.field === data.field
            );
            return {
                icon: 'git-pull-request', color: 'text-blue-500',
                message: `Suggested change — ${fieldLabel || data.field || ''}`,
                detail: suggestion
                    ? (suggestion.reason ? `Reason: ${suggestion.reason}\n\n` : '') +
                      `Suggested: ${suggestion.suggested_value.slice(0, 300)}${suggestion.suggested_value.length > 300 ? '…' : ''}`
                    : fieldLabel || '',
            };
        }

        case 'suggestion_approved': {
            const suggestion = (state?.suggestions || []).find(s => s.id === data.suggestion_id);
            return {
                icon: 'check-circle', color: 'text-green-600',
                message: `Suggestion approved — ${fieldLabel || data.field || ''}`,
                detail: suggestion
                    ? `Applied: ${suggestion.suggested_value.slice(0, 300)}${suggestion.suggested_value.length > 300 ? '…' : ''}`
                    : '',
            };
        }

        case 'suggestion_rejected':
            return {
                icon: 'x-circle', color: 'text-red-400',
                message: `Suggestion rejected — ${fieldLabel || data.field || ''}`,
                detail: '',
            };

        case 'withdrawn': {
            const detail = data.by === 'author'
                ? 'Withdrawn by the author'
                : data.requested_by_name
                    ? `Confirmed by a second editor (requested by ${data.requested_by_name})`
                    : 'Confirmed by a second editor';
            return {
                icon: 'x-circle', color: 'text-red-500',
                message: 'Proposal withdrawn',
                detail,
            };
        }

        case 'withdrawal_requested':
            return {
                icon: 'clock', color: 'text-amber-500',
                message: 'Withdrawal requested',
                detail: 'Awaiting confirmation from a second editor.',
            };

        case 'withdrawal_cancelled':
            return {
                icon: 'rotate-ccw', color: 'text-slate-400',
                message: 'Withdrawal request cancelled',
                detail: '',
            };

        case 'comment_edited':
            return {
                icon: 'pencil', color: 'text-slate-500',
                message: 'Comment edited',
                detail: '',
            };

        case 'flagged_for_removal':
            return {
                icon: 'flag', color: 'text-amber-600',
                message: `${ev.data?.target === 'comment' ? 'Comment' : 'Proposal'} flagged for removal`,
                detail: ev.data?.reason ? `Reason: ${ev.data.reason}` : '',
            };

        case 'moderation_removed':
            return {
                icon: 'ban', color: 'text-red-600',
                message: `${ev.data?.target === 'comment' ? 'Comment' : 'Proposal'} removed by admin`,
                detail: ev.data?.reason ? `Reason: ${ev.data.reason}` : 'Hidden from public; kept for the record.',
            };

        case 'moderation_rejected':
            return {
                icon: 'rotate-ccw', color: 'text-green-600',
                message: `Removal rejected — ${ev.data?.target === 'comment' ? 'comment' : 'proposal'} restored`,
                detail: ev.data?.reason ? `Reason: ${ev.data.reason}` : '',
            };

        default:
            return {
                icon: 'activity', color: 'text-slate-400',
                message: ev.event_type?.replace(/_/g, ' ') || 'Event',
                detail: '',
            };
    }
}
