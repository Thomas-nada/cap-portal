import { shortAddress, formatUser } from '../wallet.js';

export function renderNav(state) {
    const isLoggedIn = !!state.user;
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

    const menu = [
        { id: 'dashboard',    label: 'Home',         icon: 'home' },
        { id: 'list',         label: 'Registry',     icon: 'database' },
        { id: 'kanban',       label: 'Board',        icon: 'layout-dashboard' },
        { id: 'constitution', label: 'Constitution', icon: 'book-open' },
        { id: 'learn',        label: 'Guides',       icon: 'book' },
        { id: 'editors',      label: 'Editors',      icon: 'shield' },
        ...(state.user?.is_admin ? [{ id: 'bugs', label: 'Bugs', icon: 'bug' }] : []),
        ...(isLoggedIn ? [{ id: 'wizard', label: 'New CAP', icon: 'plus-square' }] : [])
    ];

    const sessionControls = isLoggedIn ? `
        <div class="flex items-center gap-2">
            <button onclick="window.openProfile()"
                class="hidden lg:block text-right px-3 py-1.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    ${state.user.display_name || shortAddress(state.user.stake_address)}
                </p>
                <p class="text-[9px] text-slate-400 font-mono leading-none mt-0.5">(${shortAddress(state.user.stake_address)})</p>
                ${state.user.is_admin ? `<p class="text-[9px] font-black text-violet-500 uppercase tracking-widest">Admin</p>` : state.user.is_editor ? `<p class="text-[9px] font-black text-blue-500 uppercase tracking-widest">Editor</p>` : ''}
            </button>
            <button onclick="window.logoutWallet()"
                class="flex items-center gap-2 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all group text-sm font-bold text-red-500">
                <i data-lucide="log-out" class="w-4 h-4"></i>
                <span class="hidden md:inline">Logout</span>
            </button>
        </div>
    ` : `
        <button onclick="window.loginWithWallet()"
            class="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all shadow-lg">
            <i data-lucide="wallet" class="w-4 h-4"></i>
            <span class="hidden md:inline">Connect Wallet</span>
        </button>
    `;

    return `
        <nav class="sticky top-6 z-50 mx-6 bg-white/70 dark:bg-slate-900/70 glass border border-slate-200/50 dark:border-slate-800/50 p-3 rounded-[2.5rem] shadow-2xl flex justify-between items-center transition-all duration-300">
            <div class="flex items-center gap-4 px-4 cursor-pointer" onclick="window.setView('dashboard')">
                <div class="w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <img src="CAP.png" alt="CAP Logo" class="w-10 h-10 object-contain">
                </div>
                <div class="hidden sm:block text-left">
                    <h1 class="font-extrabold text-lg leading-none tracking-tighter text-slate-900 dark:text-white">CAP Portal</h1>
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Constitutional Amendments</p>
                </div>
            </div>

            <div class="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-[2.2rem]">
                ${menu.map(item => `
                    <button onclick="window.setView('${item.id}')"
                        class="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all
                        ${state.view === item.id
                            ? 'bg-blue-600 text-white shadow-xl'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'}">
                        <i data-lucide="${item.icon}" class="w-4 h-4"></i>
                        <span class="hidden md:inline">${item.label}</span>
                    </button>
                `).join('')}
            </div>

            <div class="flex items-center gap-2 pr-2">
                <button onclick="window.toggleTheme()" class="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <i data-lucide="${theme === 'light' ? 'moon' : 'sun'}" class="w-5 h-5 text-slate-500"></i>
                </button>
                ${isLoggedIn ? `
                <button onclick="window.openBugReportModal()" title="Report a bug"
                    class="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-slate-400 hover:text-red-500">
                    <i data-lucide="bug" class="w-4 h-4"></i>
                </button>` : ''}
                <div class="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1"></div>
                ${sessionControls}
            </div>
        </nav>`;
}

// Theme toggle (global)
window.toggleTheme = () => {
    const html = document.documentElement;
    html.classList.toggle('dark');
    localStorage.setItem('cap_theme', html.classList.contains('dark') ? 'dark' : 'light');
    window.updateUI();
};

// Restore theme on load
const savedTheme = localStorage.getItem('cap_theme');
if (savedTheme === 'dark') document.documentElement.classList.add('dark');
