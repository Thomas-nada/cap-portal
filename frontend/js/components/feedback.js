// Feedback — a dedicated, test-only page for gathering impressions during demos.
// Anyone can read the stream; connected wallets can submit. Kept intentionally
// lightweight and visual so a room can watch feedback arrive live.

function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export const FEEDBACK_CATEGORIES = [
    { id: 'general',     label: 'General',      icon: 'message-square', cls: 'bg-slate-100 text-slate-600' },
    { id: 'ui',          label: 'Look & Feel',  icon: 'palette',        cls: 'bg-pink-100 text-pink-700' },
    { id: 'proposals',   label: 'Proposals',    icon: 'file-text',      cls: 'bg-indigo-100 text-indigo-700' },
    { id: 'governance',  label: 'Governance',   icon: 'landmark',       cls: 'bg-amber-100 text-amber-700' },
    { id: 'performance', label: 'Performance',  icon: 'gauge',          cls: 'bg-cyan-100 text-cyan-700' },
    { id: 'idea',        label: 'Idea',         icon: 'lightbulb',      cls: 'bg-violet-100 text-violet-700' },
    { id: 'praise',      label: 'Praise',       icon: 'heart',          cls: 'bg-green-100 text-green-700' },
];

function catMeta(id) {
    return FEEDBACK_CATEGORIES.find(c => c.id === id) || FEEDBACK_CATEGORIES[0];
}

function formatDate(iso) {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function stars(rating, { size = 'w-4 h-4', interactive = false } = {}) {
    let out = '';
    for (let i = 1; i <= 5; i++) {
        const filled = rating != null && i <= rating;
        const colour = filled ? 'text-amber-400 fill-amber-400' : 'text-slate-300';
        if (interactive) {
            out += `<button type="button" onclick="window.setFeedbackRating(${i})"
                aria-label="${i} star${i > 1 ? 's' : ''}"
                class="transition-transform hover:scale-110 active:scale-95">
                <i data-lucide="star" class="${size} ${colour}"></i></button>`;
        } else {
            out += `<i data-lucide="star" class="${size} ${colour}"></i>`;
        }
    }
    return out;
}

function summary(items) {
    const total = items.length;
    const rated = items.filter(f => f.rating != null);
    const avg = rated.length ? (rated.reduce((s, f) => s + f.rating, 0) / rated.length) : null;
    const roundedAvg = avg != null ? Math.round(avg) : null;

    const byCat = FEEDBACK_CATEGORIES.map(c => ({
        ...c, count: items.filter(f => f.category === c.id).length,
    })).filter(c => c.count > 0);

    return `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white/80 rounded-[2rem] border border-slate-100 p-6 text-center">
            <p class="text-3xl font-black text-slate-900">${total}</p>
            <p class="text-sm font-black text-slate-400 uppercase tracking-widest mt-1">Total</p>
        </div>
        <div class="bg-white/80 rounded-[2rem] border border-slate-100 p-6 text-center">
            <p class="text-3xl font-black text-slate-900">${avg != null ? avg.toFixed(1) : '—'}</p>
            <div class="flex items-center justify-center gap-0.5 mt-1">${stars(roundedAvg)}</div>
            <p class="text-sm font-black text-slate-400 uppercase tracking-widest mt-1">Avg rating</p>
        </div>
        <div class="bg-white/80 rounded-[2rem] border border-slate-100 p-6">
            <p class="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 text-center">By theme</p>
            <div class="flex flex-wrap gap-1.5 justify-center">
                ${byCat.length ? byCat.map(c => `
                    <span class="px-2.5 py-1 rounded-full text-sm font-bold ${c.cls}">${c.label} · ${c.count}</span>
                `).join('') : '<span class="text-slate-400 text-sm">No feedback yet</span>'}
            </div>
        </div>
    </div>`;
}

function submitForm(state) {
    if (!state.user) {
        return `
        <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-sm p-8 text-center">
            <div class="w-14 h-14 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i data-lucide="wallet" class="w-7 h-7 text-brand-primary"></i>
            </div>
            <h3 class="text-xl font-black tracking-tight text-slate-900 mb-1">Connect to share feedback</h3>
            <p class="text-slate-500 mb-5">Connect your wallet to leave feedback on the demo. Reading is open to everyone.</p>
            <button onclick="window.loginWithWallet()"
                class="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand-primary hover:opacity-90 text-white font-black transition-all">
                <i data-lucide="wallet" class="w-4 h-4"></i> Connect Wallet
            </button>
        </div>`;
    }

    const active = state.feedbackDraft?.category || 'general';
    const rating = state.feedbackDraft?.rating || 0;
    return `
    <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
        <h3 class="text-xl font-black tracking-tight text-slate-900 mb-5">Leave feedback</h3>

        <label class="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Rating <span class="text-slate-400 font-normal normal-case tracking-normal">— optional</span></label>
        <div class="flex items-center gap-1 mb-5" id="feedback-stars">${stars(rating || null, { size: 'w-7 h-7', interactive: true })}</div>

        <label class="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Theme</label>
        <div class="flex flex-wrap gap-2 mb-5">
            ${FEEDBACK_CATEGORIES.map(c => `
                <button type="button" onclick="window.setFeedbackCategory('${c.id}')"
                    class="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold border-2 transition-all
                        ${active === c.id ? 'border-brand-primary text-brand-primary bg-brand-primary/5' : 'border-slate-100 text-slate-500 hover:border-slate-200'}">
                    <i data-lucide="${c.icon}" class="w-3.5 h-3.5"></i> ${c.label}
                </button>`).join('')}
        </div>

        <label class="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Your feedback</label>
        <textarea id="feedback-message" rows="4" maxlength="4000" oninput="window._cc(this, 'cc-feedback')"
            placeholder="What worked well? What was confusing? What would you change?"
            class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-primary font-medium resize-none">${escapeHtml(state.feedbackDraft?.message || '')}</textarea>
        <p class="text-sm text-slate-400 text-right mt-1 mb-4"><span id="cc-feedback">${(state.feedbackDraft?.message || '').length}</span> / 4,000 characters</p>

        <div id="feedback-error" class="hidden text-red-500 text-sm font-bold mb-4"></div>

        <button onclick="window.submitFeedbackForm()" ${state.loading?.feedback ? 'disabled' : ''}
            class="w-full py-3 rounded-2xl bg-brand-primary hover:opacity-90 disabled:opacity-50 text-white font-black transition-all inline-flex items-center justify-center gap-2">
            <i data-lucide="send" class="w-4 h-4"></i> ${state.loading?.feedback ? 'Sending…' : 'Send feedback'}
        </button>
    </div>`;
}

function feedbackCard(f, state) {
    const c = catMeta(f.category);
    const who = f.author_display_name || (f.author_stake_address ? f.author_stake_address.slice(0, 12) + '…' : 'Anonymous');
    const canDelete = !!state.user?.is_admin;
    return `
    <div class="bg-white/80 rounded-[2rem] border border-slate-100 shadow-sm p-6">
        <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold ${c.cls}">
                    <i data-lucide="${c.icon}" class="w-3.5 h-3.5"></i> ${c.label}
                </span>
                ${f.rating != null ? `<span class="flex items-center gap-0.5">${stars(f.rating)}</span>` : ''}
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <span class="text-sm text-slate-400">${formatDate(f.created_at)}</span>
                ${canDelete ? `<button onclick="window.removeFeedback(${f.id})" title="Delete"
                    class="text-slate-300 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
            </div>
        </div>
        <p class="text-slate-700 whitespace-pre-wrap leading-relaxed">${escapeHtml(f.message)}</p>
        <p class="text-sm text-slate-400 mt-3">— ${escapeHtml(who)}</p>
    </div>`;
}

export function renderFeedback(state) {
    const items = state.feedback || [];
    const stream = items.length === 0
        ? `<div class="text-center py-16 text-slate-400">
               <i data-lucide="message-square-dashed" class="w-12 h-12 mx-auto mb-4 opacity-30"></i>
               <p class="font-bold">Be the first to leave feedback</p>
           </div>`
        : items.map(f => feedbackCard(f, state)).join('');

    return `
    <div class="space-y-8">
        <div class="flex items-start justify-between gap-4 flex-wrap">
            <div>
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-black uppercase tracking-widest mb-2">
                    <i data-lucide="flask-conical" class="w-3.5 h-3.5"></i> Test / Demo
                </div>
                <h1 class="text-3xl font-black italic tracking-tighter text-on-surface uppercase">Feedback</h1>
                <p class="text-on-surface-variant mt-1">Tell us what you think of the demo — it helps shape the portal.</p>
            </div>
        </div>

        ${summary(items)}

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            <div class="lg:col-span-2 lg:sticky lg:top-6">${submitForm(state)}</div>
            <div class="lg:col-span-3 space-y-4">
                <h2 class="text-sm font-black text-slate-400 uppercase tracking-widest px-2">Recent feedback${items.length ? ` · ${items.length}` : ''}</h2>
                ${stream}
            </div>
        </div>
    </div>`;
}
