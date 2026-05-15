import { shortAddress } from '../wallet.js';

function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function personCard({ person, user, isAdmin, onRemove, accentFrom, accentTo, icon }) {
    const isSelf = person.stake_address === user?.stake_address;
    return `
    <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-8 flex items-center gap-5 group">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br ${accentFrom} ${accentTo} flex items-center justify-center flex-shrink-0 shadow-lg">
            <i data-lucide="${icon}" class="w-6 h-6 text-white"></i>
        </div>
        <div class="min-w-0 flex-1">
            <p class="font-black text-slate-900 dark:text-white truncate">${escapeHtml(person.display_name || shortAddress(person.stake_address))}</p>
            <p class="text-xs text-slate-400 font-mono truncate">(${shortAddress(person.stake_address)})</p>
            ${isSelf ? `<span class="text-[9px] font-black text-blue-500 uppercase tracking-widest">You</span>` : ''}
        </div>
        ${isAdmin && !isSelf ? `
        <button onclick="${onRemove}('${escapeHtml(person.stake_address)}', '${escapeHtml(person.display_name || person.stake_address)}')"
            class="opacity-0 group-hover:opacity-100 flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-all">
            <i data-lucide="user-minus" class="w-4 h-4"></i>
        </button>` : '<div class="w-9"></div>'}
    </div>`;
}

export function renderEditors(state) {
    const editors = state.editors || [];
    const admins  = state.admins  || [];
    const user    = state.user;
    const isAdmin = user?.is_admin === true;

    const realAdmins  = admins.filter(a => !a.stake_address.startsWith('stake1dev_'));
    const realEditors = editors.filter(e => !e.stake_address.startsWith('stake1dev_'));
    const noAdmins    = realAdmins.length === 0;

    // ── Bootstrap: first admin self-register ──────────────────────────────────
    const bootstrap = (!isAdmin && user && noAdmins) ? `
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-[3rem] p-12 text-center mb-8">
        <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <i data-lucide="shield-check" class="w-8 h-8 text-white"></i>
        </div>
        <h2 class="text-2xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-3">No Admins Yet</h2>
        <p class="text-slate-500 mb-8 max-w-md mx-auto">You are connected and no admins exist. You can claim the initial admin role for this portal.</p>
        <button onclick="window.claimAdminRole()"
            class="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl hover:-translate-y-1 active:scale-95 transition-all">
            <i data-lucide="shield-plus" class="w-5 h-5"></i>
            Claim Admin Role
        </button>
    </div>` : '';

    // ── Admins section ────────────────────────────────────────────────────────
    const addAdminForm = isAdmin ? `
    <div class="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm p-10 mb-6">
        <h3 class="text-base font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-5">Add Admin</h3>
        <div class="flex flex-col sm:flex-row gap-4">
            <input id="new-admin-addr" type="text" placeholder="stake1…  (stake address)"
                class="flex-1 px-5 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:border-violet-500 outline-none transition-all"
                onkeydown="if(event.key==='Enter') window.submitAddAdmin()">
            <button onclick="window.submitAddAdmin()"
                class="flex items-center justify-center gap-2 px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all">
                <i data-lucide="user-plus" class="w-4 h-4"></i> Add
            </button>
        </div>
        <p id="add-admin-error" class="text-red-500 text-xs font-bold mt-3 hidden"></p>
    </div>` : '';

    const adminCards = realAdmins.length ? `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        ${realAdmins.map(a => personCard({
            person: a, user, isAdmin,
            onRemove: 'window.removeAdminConfirm',
            accentFrom: 'from-violet-500', accentTo: 'to-violet-700',
            icon: 'shield-check',
        })).join('')}
    </div>` : `
    <div class="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl mb-4">
        <p class="text-slate-400 font-bold text-sm">No admins yet.</p>
    </div>`;

    // ── Editors section ───────────────────────────────────────────────────────
    const addEditorForm = isAdmin ? `
    <div class="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm p-10 mb-6">
        <h3 class="text-base font-black italic tracking-tighter text-slate-900 dark:text-white uppercase mb-5">Add Editor</h3>
        <div class="flex flex-col sm:flex-row gap-4">
            <input id="new-editor-addr" type="text" placeholder="stake1…  (stake address)"
                class="flex-1 px-5 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:border-blue-500 outline-none transition-all"
                onkeydown="if(event.key==='Enter') window.submitAddEditor()">
            <button onclick="window.submitAddEditor()"
                class="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all">
                <i data-lucide="user-plus" class="w-4 h-4"></i> Add
            </button>
        </div>
        <p id="add-editor-error" class="text-red-500 text-xs font-bold mt-3 hidden"></p>
    </div>` : '';

    const editorCards = realEditors.length ? `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${realEditors.map(e => personCard({
            person: e, user, isAdmin,
            onRemove: 'window.removeEditorConfirm',
            accentFrom: 'from-blue-500', accentTo: 'to-blue-700',
            icon: 'pen-square',
        })).join('')}
    </div>` : `
    <div class="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
        <p class="text-slate-400 font-bold text-sm">No editors have been added yet.</p>
    </div>`;

    return `
    <div class="max-w-5xl mx-auto pb-20 fade-in">
        <header class="mb-10">
            <div class="flex items-center gap-4 mb-4">
                <div class="w-12 h-12 bg-gradient-to-br from-violet-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg text-white">
                    <i data-lucide="shield" class="w-6 h-6"></i>
                </div>
                <div>
                    <h1 class="text-6xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Roles</h1>
                    <p class="text-slate-400 text-sm font-bold mt-1">${realAdmins.length} admin${realAdmins.length !== 1 ? 's' : ''} · ${realEditors.length} editor${realEditors.length !== 1 ? 's' : ''}</p>
                </div>
            </div>
        </header>

        ${bootstrap}

        <!-- Admins -->
        <section class="mb-12">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
                    <i data-lucide="shield-check" class="w-4 h-4 text-white"></i>
                </div>
                <h2 class="text-2xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase">Admins</h2>
                <span class="text-xs text-slate-400 font-bold ml-auto">Manage editors &amp; admins</span>
            </div>
            ${addAdminForm}
            ${adminCards}
        </section>

        <!-- Editors -->
        <section>
            <div class="flex items-center gap-3 mb-6">
                <div class="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                    <i data-lucide="pen-square" class="w-4 h-4 text-white"></i>
                </div>
                <h2 class="text-2xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase">Editors</h2>
                <span class="text-xs text-slate-400 font-bold ml-auto">Review &amp; moderate proposals</span>
            </div>
            ${addEditorForm}
            ${editorCards}
        </section>
    </div>`;
}
