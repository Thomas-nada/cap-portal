/**
 * Cardano wallet connection and CIP-8 authentication.
 * Dynamically discovers any CIP-30 compliant wallet injected into window.cardano.
 */

import { getChallenge, verifyAuth } from './api.js';
import { DEV_MODE } from './config.js';

function isRealWallet(obj) {
    // Filter out compatibility shims injected by other wallets (e.g. Eternl injects
    // window.cardano.nami). A real CIP-30 wallet exposes both enable() and isEnabled().
    return obj && typeof obj.enable === 'function' && typeof obj.isEnabled === 'function';
}

export function getAvailableWallets() {
    if (typeof window === 'undefined' || !window.cardano) return [];
    return Object.keys(window.cardano)
        .filter(id => isRealWallet(window.cardano[id]))
        .map(id => {
            const w = window.cardano[id];
            return {
                id,
                label: w.name || capitalize(id),
                icon: w.icon || null,
            };
        });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * CIP-30 wallets reject with plain objects such as { code, info }, not
 * necessarily Error instances. Extract a useful message for the UI.
 */
export function walletErrorMessage(error, fallback = 'The wallet request failed') {
    if (typeof error === 'string' && error.trim()) return error.trim();
    if (error && typeof error === 'object') {
        for (const key of ['message', 'info', 'detail', 'reason']) {
            const value = error[key];
            if (typeof value === 'string' && value.trim()) return value.trim();
        }
    }
    return fallback;
}

function walletStepError(step, error, codeMessages = {}) {
    const code = error && typeof error === 'object' ? error.code : undefined;
    const fallback = codeMessages[code] || 'The wallet did not provide an explanation';
    return new Error(`${step}: ${walletErrorMessage(error, fallback)}`);
}

async function walletStep(step, action, codeMessages = {}) {
    try {
        return await action();
    } catch (error) {
        throw walletStepError(step, error, codeMessages);
    }
}

const API_ERROR_MESSAGES = {
    [-1]: 'The wallet received an invalid request',
    [-2]: 'The wallet encountered an internal error',
    [-3]: 'The wallet refused access',
    [-4]: 'The active wallet account changed; please try connecting again',
};

const DATA_SIGN_ERROR_MESSAGES = {
    1: 'The wallet could not generate the login signature',
    2: 'This account cannot sign with its stake address',
    3: 'The signing request was declined in the wallet',
};

/**
 * Connect a wallet and authenticate via CIP-8 challenge-response.
 * Requests CIP-95 extensions if available. Verifies mainnet (networkId=1).
 * Returns {token, stake_address, display_name, is_editor} on success.
 */
export async function connectAndAuth(walletId, displayName = null) {
    const walletObj = window.cardano?.[walletId];
    if (!walletObj) throw new Error(`${walletId} wallet not found`);

    // Enable with CIP-95 extensions if the wallet supports it
    let api;
    try {
        api = await walletObj.enable({ extensions: [{ cip: 95 }] });
    } catch {
        // Fall back to standard CIP-30 enable if CIP-95 not supported.
        api = await walletStep(
            `Could not connect to ${walletObj.name || capitalize(walletId)}`,
            () => walletObj.enable(),
            API_ERROR_MESSAGES,
        );
    }
    if (!api) throw new Error(`${walletObj.name || capitalize(walletId)} did not return a wallet connection`);

    // Verify network — mainnet=1, testnet=0
    const networkId = await walletStep(
        'Could not read the wallet network',
        () => api.getNetworkId(),
        API_ERROR_MESSAGES,
    );
    if (networkId !== 1 && !DEV_MODE) {
        throw new Error('Please switch your wallet to Cardano mainnet and try again.');
    }

    // Get stake address (reward address) — returned as hex-encoded address bytes
    const rewardAddresses = await walletStep(
        'Could not read the wallet stake address',
        () => api.getRewardAddresses(),
        API_ERROR_MESSAGES,
    );
    if (!rewardAddresses?.length) {
        throw new Error('No stake address found in wallet');
    }
    const stakeAddressHex = rewardAddresses[0];

    // Convert hex to bech32 stake1... address for display and server storage
    const stakeAddress = hexToBech32StakeAddress(stakeAddressHex) || stakeAddressHex;

    // Get challenge from server
    const { challenge } = await getChallenge();

    // Sign challenge — wallets expect payload as hex
    const challengeHex = stringToHex(challenge);
    const signed = await walletStep(
        'Could not approve the login signature',
        () => api.signData(stakeAddressHex, challengeHex),
        DATA_SIGN_ERROR_MESSAGES,
    );
    const { signature, key } = signed || {};
    if (!signature || !key) {
        throw new Error('The wallet returned an incomplete login signature');
    }

    // Verify on server and get token
    const result = await verifyAuth({
        stake_address: stakeAddress,
        challenge,
        signature,
        key,
        display_name: displayName,
    });

    localStorage.setItem('cap_token', result.token);
    localStorage.setItem('cap_wallet', walletId);
    localStorage.setItem('cap_stake_address', result.stake_address);
    localStorage.setItem('cap_display_name', result.display_name || '');

    return result;
}

export function logout() {
    localStorage.removeItem('cap_token');
    localStorage.removeItem('cap_wallet');
    localStorage.removeItem('cap_stake_address');
    // cap_display_name is intentionally kept so returning users skip the name prompt
}

/**
 * WC-11: confirm the connected wallet still exposes the same mainnet identity
 * we authenticated as. Extensions can silently switch account or network while
 * a session is open, leaving the portal authorising the old wallet. Returns:
 *   { ok: true }                          — unchanged, still on mainnet
 *   { ok: false, reason: 'account' }      — the reward address changed
 *   { ok: false, reason: 'network' }      — the wallet left mainnet
 *   { ok: false, reason: 'disconnected' } — the wallet is no longer connected /
 *                                           exposes no reward address
 *   null                                  — indeterminate (extension not present
 *                                           yet / dev session / transient error)
 * A null result never invalidates the session — only a definite change does.
 */
export async function revalidateWalletIdentity() {
    const session = getSavedSession();
    if (!session?.stake_address) return null;
    const walletId = session.wallet;
    if (!walletId || walletId === 'dev') return null;
    const walletObj = window.cardano?.[walletId];
    if (!walletObj) return null;  // extension not injected — may be transient
    try {
        // The user disconnected this dApp in the wallet — end the session (WC-11).
        if (!(await walletObj.isEnabled())) return { ok: false, reason: 'disconnected' };
        const api = await walletObj.enable();
        const networkId = await api.getNetworkId();
        if (networkId !== 1 && !DEV_MODE) return { ok: false, reason: 'network' };
        const rewards = await api.getRewardAddresses();
        const current = rewards?.length ? (hexToBech32StakeAddress(rewards[0]) || rewards[0]) : null;
        // No reward address exposed anymore — treat as a disconnect, not "unchanged".
        if (!current) return { ok: false, reason: 'disconnected' };
        if (current !== session.stake_address) return { ok: false, reason: 'account' };
        return { ok: true };
    } catch {
        return null;  // transient wallet error — don't sign the user out over a hiccup
    }
}

export function getSavedSession() {
    const token = localStorage.getItem('cap_token');
    if (!token) return null;
    return {
        token,
        stake_address: localStorage.getItem('cap_stake_address'),
        display_name: localStorage.getItem('cap_display_name') || null,
        wallet: localStorage.getItem('cap_wallet'),
    };
}

/** Dev mode: bypass wallet auth with a fake stake address. */
export async function devLogin(displayName = 'Dev User') {
    if (!DEV_MODE) throw new Error('Dev mode disabled');
    const fakeStake = 'stake1dev_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('cap_token', 'dev-token-' + fakeStake);
    localStorage.setItem('cap_stake_address', fakeStake);
    localStorage.setItem('cap_display_name', displayName);
    localStorage.setItem('cap_wallet', 'dev');
    return { stake_address: fakeStake, display_name: displayName, is_editor: false };
}

// ── Wallet selection modal ────────────────────────────────────────────────────

export function renderWalletModal() {
    const available = getAvailableWallets();

    const walletList = available.length === 0
 ? `<div class="text-center py-8">
 <i data-lucide="wallet" class="w-12 h-12 text-slate-300 mx-auto mb-4"></i>
 <p class="text-slate-500 font-bold mb-2">No wallet detected</p>
 <p class="text-slate-400 text-sm">Install a Cardano wallet extension (Eternl, Vespr, Lace…) and refresh.</p>
           </div>`
 : `<div class="space-y-2 mb-2" id="wallet-list">
               ${available.map(w => `
               <button onclick="window._walletModalPickWallet('${w.id}')"
 class="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-100 hover:border-blue-400 transition-all text-left group">
                   ${w.icon
 ? `<img src="${w.icon}" class="w-8 h-8 rounded-xl flex-shrink-0" alt="${w.label}">`
 : `<div class="w-8 h-8 rounded-xl flex-shrink-0 bg-slate-100 flex items-center justify-center text-sm font-black text-slate-500">${w.label.charAt(0)}</div>`}
 <span class="font-black text-slate-900 group-hover:text-blue-600 transition-colors">${w.label}</span>
 <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300 ml-auto group-hover:text-blue-400 transition-colors"></i>
               </button>`).join('')}
           </div>`;

    const devSection = DEV_MODE
 ? `<div class="pt-4 border-t border-slate-100 mt-4">
               <button onclick="window._walletModalDevLogin()"
 class="w-full py-3 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
                   Dev Login (no wallet)
               </button>
           </div>`
        : '';

    return `
    <div id="wallet-modal-backdrop"
         onclick="if(event.target===this) document.getElementById('wallet-modal-backdrop').remove()"
 class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div class="bg-white/80 rounded-[2.5rem] border border-slate-100 shadow-2xl w-full max-w-sm p-6 sm:p-8">
 <div class="flex items-center justify-between mb-6">
 <h2 id="wallet-modal-title" class="text-xl font-black text-slate-900 ">Connect Wallet</h2>
                <button onclick="document.getElementById('wallet-modal-backdrop').remove()"
 class="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
 <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <div id="wallet-modal-body">
                ${walletList}
                ${devSection}
            </div>
        </div>
    </div>`;
}

/** Swap modal body to display-name step after wallet is chosen. */
export function showDisplayNameStep(walletId, walletLabel) {
    const title = document.getElementById('wallet-modal-title');
    const body  = document.getElementById('wallet-modal-body');
    if (title) title.textContent = walletLabel;
    if (body) body.innerHTML = `
 <p class="text-sm text-slate-500 mb-4">
            Choose a display name others will see on your proposals and comments.
            You can leave it blank to use your stake address.
        </p>
        <input id="wallet-display-name"
               type="text"
               placeholder="Display name (optional)"
               maxlength="40"
 class="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 bg-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400 mb-4 font-medium"
               onkeydown="if(event.key==='Enter') window._walletModalSelect('${walletId}', document.getElementById('wallet-display-name').value.trim())">
        <button onclick="window._walletModalSelect('${walletId}', document.getElementById('wallet-display-name').value.trim())"
 class="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-colors">
            Sign in with ${walletLabel}
        </button>
        <button onclick="window._walletModalBack()"
 class="w-full mt-2 py-3 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
            Back
        </button>`;

    document.getElementById('wallet-display-name')?.focus();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stringToHex(str) {
    return Array.from(new TextEncoder().encode(str))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Bech32 implementation for stake address conversion
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32Polymod(values) {
    let chk = 1;
    for (const v of values) {
        const top = chk >> 25;
        chk = (chk & 0x1ffffff) << 5 ^ v;
        for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= BECH32_GEN[i];
    }
    return chk;
}

function bech32HrpExpand(hrp) {
    const r = [];
    for (const c of hrp) r.push(c.charCodeAt(0) >> 5);
    r.push(0);
    for (const c of hrp) r.push(c.charCodeAt(0) & 31);
    return r;
}

function bech32Checksum(hrp, data) {
    const polymod = bech32Polymod(bech32HrpExpand(hrp).concat(data).concat([0,0,0,0,0,0])) ^ 1;
    const out = [];
    for (let i = 5; i >= 0; i--) out.push((polymod >> (5 * i)) & 31);
    return out;
}

function convertBits(data, from, to) {
    let acc = 0, bits = 0;
    const out = [];
    const maxv = (1 << to) - 1;
    for (const v of data) {
        acc = (acc << from) | v;
        bits += from;
        while (bits >= to) { bits -= to; out.push((acc >> bits) & maxv); }
    }
    if (bits > 0) out.push((acc << (to - bits)) & maxv);
    return out;
}

function hexToBech32StakeAddress(hex) {
    if (typeof hex !== 'string') return null;
    if (hex.startsWith('stake')) return hex;
    try {
        const bytes = hex.match(/.{2}/g)?.map(b => parseInt(b, 16));
        if (!bytes || bytes.length < 29) return null;
        // Stake address header: 0xe1 = mainnet, 0xe0 = testnet
        const header = bytes[0];
        if (header !== 0xe1 && header !== 0xe0) return null;
        const hrp = header === 0xe1 ? 'stake' : 'stake_test';
        const data5 = convertBits(bytes, 8, 5);
        const checksum = bech32Checksum(hrp, data5);
        return hrp + '1' + data5.concat(checksum).map(d => BECH32_CHARSET[d]).join('');
    } catch {
        return null;
    }
}

export function shortAddress(addr) {
    if (!addr) return '';
    if (addr.length <= 16) return addr;
    return addr.slice(0, 8) + '...' + addr.slice(-6);
}

/** Format a user identity as "Name (stake1...abc)" or just "stake1...abc" if no name. */
export function formatUser(display_name, stake_address) {
    const short = shortAddress(stake_address);
    if (display_name && display_name.trim()) return `${display_name} (${short})`;
    return short;
}
