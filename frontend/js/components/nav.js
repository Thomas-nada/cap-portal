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
 class="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white">
 <i data-lucide="bell" class="w-5 h-5"></i>
            ${state.unreadCount > 0 ? `<span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-secondary text-white text-sm font-black flex items-center justify-center">${state.unreadCount > 9 ? '9+' : state.unreadCount}</span>` : ''}
        </button>
    ` : '';

    const sessionControls = isLoggedIn ? `
 <div class="flex items-center gap-2">
            <button onclick="window.openProfile()"
 class="hidden lg:block text-right px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors">
 <p class="text-sm font-semibold text-white uppercase tracking-widest leading-none">
                    ${state.user.display_name || shortAddress(state.user.stake_address)}
                </p>
 <p class="text-sm text-white/60 font-mono leading-none mt-0.5">(${shortAddress(state.user.stake_address)})</p>
 ${state.user.is_admin ? `<p class="text-sm font-semibold text-brand-tertiary uppercase tracking-widest">Admin</p>` : state.user.is_editor ? `<p class="text-sm font-semibold text-brand-secondary-container uppercase tracking-widest">Editor</p>` : ''}
            </button>
            <button onclick="window.logoutWallet()"
 class="flex items-center gap-2 px-3 sm:px-4 py-2 hover:bg-white/10 rounded-full transition-all group text-sm font-semibold text-white border-2 border-white/30">
 <i data-lucide="log-out" class="w-4 h-4"></i>
 <span class="hidden md:inline">Logout</span>
            </button>
        </div>
    ` : `
        <button onclick="window.loginWithWallet()"
 class="flex items-center gap-2 px-5 sm:px-8 h-11 sm:h-12 bg-white hover:bg-brand-primary-container active:scale-[0.98] text-brand-primary rounded-full text-sm font-semibold transition-all shadow-[0_3px_8px_rgba(0,0,0,0.15)]">
 <i data-lucide="wallet" class="w-4 h-4"></i>
 <span class="hidden md:inline">Connect Wallet</span>
        </button>
    `;

    const mobilePanel = mobileOpen ? `
 <div class="lg:hidden bg-[#021d80] border-t border-white/10 px-4 py-3 space-y-1">
            ${menu.map(item => `
            <button onclick="window.setView('${item.id}')"
 class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all
                    ${state.view === item.id ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10'}">
 <i data-lucide="${item.icon}" class="w-4 h-4"></i>
                ${item.label}
            </button>
            `).join('')}
            ${isLoggedIn ? `
 <div class="pt-3 mt-2 border-t border-white/10 px-4 py-2">
 <p class="text-sm font-semibold text-white/80 uppercase tracking-widest leading-none">
                    ${state.user.display_name || shortAddress(state.user.stake_address)}
                </p>
 <p class="text-sm text-white/50 font-mono leading-none mt-0.5">(${shortAddress(state.user.stake_address)})</p>
            </div>
            ` : ''}
        </div>
    ` : '';

    return `
 <nav class="bg-[#0228aa] shadow-md">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
 <div class="flex items-center gap-3 cursor-pointer" onclick="window.setView('dashboard')">
 <div class="w-11 h-11 flex items-center justify-center flex-shrink-0">
 <img src="CAP-white.png" alt="CAP Logo" class="w-11 h-11 object-contain">
                </div>
 <div class="hidden sm:block text-left">
 <h1 class="font-semibold text-base leading-none tracking-tight text-white">Constitutional Amendment Portal</h1>
 <p class="text-sm font-semibold text-white/60 uppercase tracking-[0.2em] mt-1">Cardano Constitution</p>
                </div>
            </div>

 <div class="hidden lg:flex items-center gap-1">
                ${menu.map(item => `
                    <button onclick="window.setView('${item.id}')"
 class="flex items-center gap-2 px-3 py-2 mx-0.5 text-sm font-medium rounded-lg transition-all
                        ${state.view === item.id
                            ? 'text-white bg-white/15'
                            : 'text-white/70 hover:text-white hover:bg-white/10'}">
 <i data-lucide="${item.icon}" class="w-4 h-4"></i>
 <span class="hidden md:inline">${item.label}</span>
                    </button>
                `).join('')}
            </div>

 <div class="flex items-center gap-2 pr-1 sm:pr-2">
                ${bell}
                ${sessionControls}
                <button onclick="window.toggleMobileNav()"
 class="lg:hidden w-10 h-10 flex items-center justify-center rounded-2xl text-white hover:bg-white/10 transition-colors">
 <i data-lucide="${mobileOpen ? 'x' : 'menu'}" class="w-5 h-5"></i>
                </button>
            </div>
        </div>
        ${mobilePanel}
    </nav>`;
}
