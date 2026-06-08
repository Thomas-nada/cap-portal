import cbor2
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


def verify_cip8_signature(signature_hex: str, key_hex: str, challenge: str) -> bool:
    """
    Verify a CIP-8 (COSE_Sign1) signature produced by a Cardano wallet's signData.
    Returns True if the signature is valid and the payload contains our challenge.
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
            return False

        protected_raw = cose[0]   # bstr (encoded protected headers)
        payload      = cose[2]   # bstr (may be None for detached content)
        signature    = cose[3]   # bstr

        # Some wallets use detached content (payload=None in COSE) and pass it out-of-band.
        # In CIP-30 signData the payload is always attached, so None means malformed.
        if payload is None:
            return False

        # COSE_Key: map with -2 = x (public key bytes for Ed25519)
        cose_key = cbor2.loads(key_bytes)
        if hasattr(cose_key, 'value'):
            cose_key = cose_key.value
        pub_key_bytes = cose_key.get(-2)
        if not pub_key_bytes:
            return False

        # Sig_Structure: ["Signature1", protected, external_aad, payload]
        sig_structure = cbor2.dumps(["Signature1", protected_raw, b"", payload])

        # Verify Ed25519
        pub_key = Ed25519PublicKey.from_public_bytes(pub_key_bytes)
        pub_key.verify(signature, sig_structure)

        # Verify our challenge is in the signed payload.
        # The wallet signed the hex-encoded challenge bytes, so payload == challenge.encode()
        try:
            payload_text = payload.decode("utf-8")
        except Exception:
            payload_text = payload.hex()

        return challenge in payload_text

    except InvalidSignature:
        logger.warning("CIP-8 verify: Ed25519 signature mismatch")
        return False
    except Exception as e:
        logger.warning("CIP-8 verify error: %s", e)
        return False


def create_token(stake_address: str, display_name: str | None) -> str:
    secret = config.get("JWT_SECRET", "dev-secret-change-in-production")
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": stake_address,
        "display_name": display_name,
        "exp": expire,
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    secret = config.get("JWT_SECRET", "dev-secret-change-in-production")
    try:
        return jwt.decode(token, secret, algorithms=[ALGORITHM])
    except JWTError:
        return None
