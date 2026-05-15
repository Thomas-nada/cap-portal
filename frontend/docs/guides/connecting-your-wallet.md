# Connecting Your Wallet

The CAP Portal uses Cardano wallet authentication (CIP-30 and CIP-8). No passwords, no email — your wallet is your identity.

---

## Supported wallets

Any CIP-30 compatible browser wallet will work:

- **Eternl** — eternl.io (recommended)
- **Lace** — lace.io
- **Nami** — namiwallet.io
- **Vespr**, **Typhon**, **Flint**, and other CIP-30 wallets

Install your wallet as a browser extension before proceeding.

---

## How to connect

1. Click **Connect Wallet** in the top navigation bar
2. Select your wallet from the list of detected wallets
3. Your wallet will prompt you to **sign a message** — this proves ownership without any transaction or fee
4. You're now logged in — your stake address is your identity

---

## What the portal receives

The portal receives:
- Your **stake address** (public, derived from your wallet)
- A **signed message** to verify you control that address
- A **display name** you can choose

The portal does **not** receive your private keys, seed phrase, or any funds. No transaction is submitted. Signing a message is a read-only operation.

---

## Display name

When you first connect, you can set a display name. This is stored alongside your stake address and shown on proposals and comments you author. You can use any name or handle — there is no identity verification.

---

## Dev mode

If you are running the portal locally for development, a **Dev Login** button appears in the wallet modal. This creates a test account without requiring a real wallet, useful for testing.

---

## Disconnecting

Click your stake address / display name in the navigation bar and select **Disconnect**. This clears your session from the browser. Your proposals and comments remain on the portal — they are associated with your stake address, not your current session token.
