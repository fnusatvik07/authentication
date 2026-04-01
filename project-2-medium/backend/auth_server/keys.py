"""RSA key management for asymmetric JWT signing.

Why RS256 instead of HS256 for multi-server architectures:
- HS256: Same secret on both servers. If resource server is compromised, attacker can forge tokens.
- RS256: Private key ONLY on auth server. Resource server has public key (can verify, NOT forge).

Key generation: Run this file directly to generate a new key pair.
"""

import os
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

KEYS_DIR = Path(__file__).parent / "jwt_keys"


def generate_rsa_keys():
    """Generate a new RSA key pair and save to files."""
    KEYS_DIR.mkdir(exist_ok=True)

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    # Save private key (auth server only — NEVER share this)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    (KEYS_DIR / "private.pem").write_bytes(private_pem)

    # Save public key (safe to distribute to all resource servers)
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    (KEYS_DIR / "public.pem").write_bytes(public_pem)

    print(f"Keys generated in {KEYS_DIR}/")
    print(f"  private.pem — Keep SECRET, only on auth server")
    print(f"  public.pem  — Share with resource servers")
    return private_pem, public_pem


def load_private_key() -> bytes:
    """Load the private key for signing tokens (auth server only)."""
    key_path = KEYS_DIR / "private.pem"
    if not key_path.exists():
        print("No RSA keys found. Generating new key pair...")
        generate_rsa_keys()
    return key_path.read_bytes()


def load_public_key() -> bytes:
    """Load the public key for verifying tokens (any server)."""
    key_path = KEYS_DIR / "public.pem"
    if not key_path.exists():
        print("No RSA keys found. Generating new key pair...")
        generate_rsa_keys()
    return key_path.read_bytes()


if __name__ == "__main__":
    generate_rsa_keys()
