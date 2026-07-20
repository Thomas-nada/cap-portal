import cbor2
import hashlib
import secrets
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.exceptions import InvalidSignature
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
import os
import logging
import config

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

# When no JWT_SECRET is configured (local dev) we fall back to a RANDOM
# per-process secret — never a shared hardcoded string, which would let anyone
# forge tokens on any instance that forgot to set the secret. Tokens minted in
# this mode simply don't survive a restart, which is fine for local dev.
# Production must set JWT_SECRET; main.py refuses to start otherwise.
_EPHEMERAL_SECRET = secrets.token_hex(32)


def _jwt_secret() -> str:
    return config.get("JWT_SECRET") or _EPHEMERAL_SECRET

# ── Bech32 (BIP-173) encoding, used for Cardano stake addresses ───────────────

_BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
_BECH32_GEN = [0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3]


def _bech32_polymod(values):
    chk = 1
    for v in values:
        top = chk >> 25
        chk = (chk & 0x1FFFFFF) << 5 ^ v
        for i in range(5):
            if (top >> i) & 1:
                chk ^= _BECH32_GEN[i]
    return chk


def _bech32_hrp_expand(hrp):
    return [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp]


def _bech32_create_checksum(hrp, data):
    polymod = _bech32_polymod(_bech32_hrp_expand(hrp) + data + [0] * 6) ^ 1
    return [(polymod >> 5 * (5 - i)) & 31 for i in range(6)]


def _convertbits(data, frombits, tobits):
    acc = 0
    bits = 0
    ret = []
    maxv = (1 << tobits) - 1
    for value in data:
        acc = (acc << frombits) | value
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            ret.append((acc >> bits) & maxv)
    if bits:
        ret.append((acc << (tobits - bits)) & maxv)
    return ret


def _bech32_encode(hrp: str, payload: bytes) -> str:
    data = _convertbits(payload, 8, 5)
    return hrp + "1" + "".join(_BECH32_CHARSET[d] for d in data + _bech32_create_checksum(hrp, data))


def derive_stake_addresses(pub_key_bytes: bytes) -> set[str]:
    """Derive the bech32 stake addresses (mainnet + testnet) that belong to an
    Ed25519 staking public key. A stake address is the blake2b-224 hash of the
    key, prefixed with a header byte (0xe1 mainnet / 0xe0 testnet)."""
    cred = hashlib.blake2b(pub_key_bytes, digest_size=28).digest()
    return {
        _bech32_encode("stake", b"\xe1" + cred),
        _bech32_encode("stake_test", b"\xe0" + cred),
    }


def verify_cip8_signature(signature_hex: str, key_hex: str, challenge: str) -> bytes | None:
    """
    Verify a CIP-8 (COSE_Sign1) signature produced by a Cardano wallet's signData.
    Returns the verified Ed25519 public key bytes if the signature is valid and
    the payload contains our challenge, else None. Callers MUST bind the returned
    key to the claimed stake address (see derive_stake_addresses) — a valid
    signature alone proves nothing about who the signer is.
    """
    try:
        sig_bytes = bytes.fromhex(signature_hex)
        key_bytes = bytes.fromhex(key_hex)

        # COSE_Sign1 may arrive as CBOR tag 18 ([ protected, unprotected, payload, sig ])
        # or as an untagged array depending on the wallet. Unwrap the tag if present.
        decoded = cbor2.loads(sig_bytes)
        if hasattr(decoded, 'value'):
            # CBORTag — unwrap to the inner array
            cose = decoded.value
        else:
            cose = decoded

        if not isinstance(cose, list) or len(cose) != 4:
            return None

        protected_raw = cose[0]   # bstr (encoded protected headers)
        payload      = cose[2]   # bstr (may be None for detached content)
        signature    = cose[3]   # bstr

        # Some wallets use detached content (payload=None in COSE) and pass it out-of-band.
        # In CIP-30 signData the payload is always attached, so None means malformed.
        if payload is None:
            return None

        # COSE_Key: map with -2 = x (public key bytes for Ed25519)
        cose_key = cbor2.loads(key_bytes)
        if hasattr(cose_key, 'value'):
            cose_key = cose_key.value
        pub_key_bytes = cose_key.get(-2)
        if not pub_key_bytes:
            return None

        # Sig_Structure: ["Signature1", protected, external_aad, payload]
        sig_structure = cbor2.dumps(["Signature1", protected_raw, b"", payload])

        # Verify Ed25519
        pub_key = Ed25519PublicKey.from_public_bytes(pub_key_bytes)
        pub_key.verify(signature, sig_structure)

        # Verify the signed payload is exactly our challenge.
        # The wallet signed the hex-encoded challenge bytes, so payload == challenge.encode()
        try:
            payload_text = payload.decode("utf-8")
        except Exception:
            payload_text = payload.hex()

        if payload_text != challenge:
            return None
        return bytes(pub_key_bytes)

    except InvalidSignature:
        logger.warning("CIP-8 verify: Ed25519 signature mismatch")
        return None
    except Exception as e:
        logger.warning("CIP-8 verify error: %s", e)
        return None


def create_token(stake_address: str, display_name: str | None) -> str:
    secret = _jwt_secret()
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": stake_address,
        "display_name": display_name,
        "exp": expire,
        # Unique id so an explicit logout can revoke this specific token.
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    secret = _jwt_secret()
    try:
        return jwt.decode(token, secret, algorithms=[ALGORITHM])
    except JWTError:
        return None
