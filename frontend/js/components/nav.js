import { shortAddress } from '../wallet.js';

export function renderNav(state) {
    const isLoggedIn = !!state.user;
    const mobileOpen = !!state.mobileNavOpen;

    const menu = [
        { id: 'dashboard',    label: 'Home',         icon: 'home' },
        { id: 'list',         label: 'Proposals',    icon: 'database' },
        { id: 'kanban',       label: 'Board',        icon: 'layout-dashboard' },
        { id: 'constitution', label: 'Constitution', icon: 'book-open' },
        { id: 'learn',        label: 'Guides',       icon: 'book' },
        ...(state.user?.is_admin ? [{ id: 'moderation', label: 'Moderation', icon: 'gavel' }] : []),
        ...(state.user?.is_admin ? [{ id: 'bugs', label: 'Bugs', icon: 'bug' }] : []),
        ...(isLoggedIn ? [{ id: 'wizard', label: 'New CAP', icon: 'plus-square' }] : [])
    ];

    const bell = isLoggedIn ? `
        <button onclick="window.toggleNotifications()" title="Notifications"
 class="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600">
 <i data-lucide="bell" class="w-5 h-5"></i>
            ${state.unreadCount > 0 ? `<span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-primary text-white text-[10px] font-black flex items-center justify-center">${state.unreadCount > 9 ? '9+' : state.unreadCount}</span>` : ''}
        </button>
    ` : '';

    const sessionControls = isLoggedIn ? `
 <div class="flex items-center gap-2">
            <button onclick="window.openProfile()"
 class="hidden lg:block text-right px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors">
 <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none">
                    ${state.user.display_name || shortAddress(state.user.stake_address)}
                </p>
 <p class="text-[9px] text-slate-400/80 font-mono leading-none mt-0.5">(${shortAddress(state.user.stake_address)})</p>
 ${state.user.is_admin ? `<p class="text-[9px] font-semibold text-amber-600 uppercase tracking-widest">Admin</p>` : state.user.is_editor ? `<p class="text-[9px] font-semibold text-brand-secondary uppercase tracking-widest">Editor</p>` : ''}
            </button>
            <button onclick="window.logoutWallet()"
 class="flex items-center gap-2 px-3 sm:px-4 py-2 hover:bg-slate-100 rounded-full transition-all group text-sm font-semibold text-slate-600 border-2 border-slate-200">
 <i data-lucide="log-out" class="w-4 h-4"></i>
 <span class="hidden md:inline">Logout</span>
            </button>
        </div>
    ` : `
        <button onclick="window.loginWithWallet()"
 class="flex items-center gap-2 px-5 sm:px-8 h-11 sm:h-12 bg-brand-primary hover:bg-brand-primary-fixed-dim active:bg-brand-primary-active active:scale-[0.98] text-brand-on-primary rounded-full text-sm font-semibold transition-all shadow-[0_3px_8px_rgba(0,0,0,0.15)]">
 <i data-lucide="wallet" class="w-4 h-4"></i>
 <span class="hidden md:inline">Connect Wallet</span>
        </button>
    `;

    const mobilePanel = mobileOpen ? `
 <div class="lg:hidden mx-6 mt-2 bg-white/95 backdrop-blur-xl border border-white/40 rounded-[2rem] shadow-xl p-4 space-y-1">
            ${menu.map(item => `
            <button onclick="window.setView('${item.id}')"
 class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all
                    ${state.view === item.id ? 'bg-brand-primary/10 text-brand-primary' : 'text-slate-600 hover:bg-slate-100'}">
 <i data-lucide="${item.icon}" class="w-4 h-4"></i>
                ${item.label}
            </button>
            `).join('')}
            ${isLoggedIn ? `
 <div class="pt-3 mt-2 border-t border-slate-100 px-4 py-2">
 <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none">
                    ${state.user.display_name || shortAddress(state.user.stake_address)}
                </p>
 <p class="text-[9px] text-slate-400/80 font-mono leading-none mt-0.5">(${shortAddress(state.user.stake_address)})</p>
            </div>
            ` : ''}
        </div>
    ` : '';

    return `
 <nav class="sticky top-6 z-50 mx-6 bg-white/80 backdrop-blur-xl border border-white/40 p-3 rounded-[2.5rem] shadow-xl flex justify-between items-center transition-all duration-300">
 <div class="flex items-center gap-4 px-2 sm:px-4 cursor-pointer" onclick="window.setView('dashboard')">
 <div class="w-10 h-10 flex items-center justify-center flex-shrink-0">
 <img src="CAP.png" alt="CAP Logo" class="w-10 h-10 object-contain">
                </div>
 <div class="hidden sm:block text-left">
 <h1 class="font-semibold text-lg leading-none tracking-tight text-slate-900">CAP Portal</h1>
 <p class="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Constitutional Amendments</p>
                </div>
            </div>

 <div class="hidden lg:flex items-center gap-1">
                ${menu.map(item => `
                    <button onclick="window.setView('${item.id}')"
 class="flex items-center gap-2 px-4 py-2 mx-0.5 text-sm font-medium transition-all border-b-2
                        ${state.view === item.id
                            ? 'text-brand-primary border-brand-primary'
                            : 'text-slate-600 border-transparent hover:text-brand-primary'}">
 <i data-lucide="${item.icon}" class="w-4 h-4"></i>
 <span class="hidden md:inline">${item.label}</span>
                    </button>
                `).join('')}
            </div>

 <div class="flex items-center gap-2 pr-1 sm:pr-2">
                ${bell}
                ${sessionControls}
                <button onclick="window.toggleMobileNav()"
 class="lg:hidden w-10 h-10 flex items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-100 transition-colors">
 <i data-lucide="${mobileOpen ? 'x' : 'menu'}" class="w-5 h-5"></i>
                </button>
            </div>
        </nav>
        ${mobilePanel}`;
}
