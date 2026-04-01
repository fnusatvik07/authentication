# Password Hashing, Salting & Storage - Deep Dive

## The Golden Rule

**Never store passwords in plaintext. Ever.**

When a user creates an account with password `"MyP@ss123"`, your database should store something like:
```
$2b$12$LJ3m9bK0QpGh1fE7Rk7v.OZB8tKxI3YxmDqN5vPpT6kR1nJ0V8pS2
```

Not the password itself. Here's exactly how that works.

## The Password Storage Pipeline

```
User types password
        │
        ▼
┌─────────────────┐
│ "MyP@ss123"     │  ← Plaintext (exists only in memory, briefly)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Salt   │  ← Random bytes, unique per password
│ "LJ3m9bK0Qp..." │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ Hash Function (bcrypt)      │
│                             │
│ Input: password + salt      │
│ Cost factor: 12 rounds      │
│ (2^12 = 4,096 iterations)  │
│                             │
│ Output: fixed-length hash   │
└────────┬────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────┐
│ "$2b$12$LJ3m9bK0QpGh1fE7Rk7v.OZB8tKxI3YxmDqN5vPpT6kR1nJ│
│  ▲  ▲   ▲                    ▲                            │
│  │  │   │                    │                            │
│  │  │   Salt (22 chars)      Hash (31 chars)              │
│  │  Cost factor (12)                                      │
│  Algorithm ($2b = bcrypt)                                  │
└───────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Store in DB     │  ← Only the hash string is stored
│ password_hash   │
└─────────────────┘
```

## What is Hashing?

A **hash function** takes any input and produces a fixed-size output (the "hash" or "digest"). It's a **one-way** function — you cannot reverse it to get the original input.

```python
import hashlib

# Same input always produces same output (deterministic)
hashlib.sha256("password".encode()).hexdigest()
# → "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"

# Tiny change in input → completely different output (avalanche effect)
hashlib.sha256("password1".encode()).hexdigest()
# → "0b14d501a594442a01c6859541bcb3e8164d183d32937b851835442f69d5c94e"

# Cannot go backwards: hash → original password is computationally infeasible
```

### Why Not Just Use SHA-256?

Plain SHA-256 is **too fast**. A modern GPU can compute ~10 billion SHA-256 hashes per second. An attacker with a leaked database can try every possible password very quickly.

| Algorithm | Hashes/Second (GPU) | Time to crack "password123" |
|-----------|--------------------|-----------------------------|
| SHA-256 | ~10 billion | < 1 second |
| MD5 | ~25 billion | < 1 second |
| bcrypt (cost=12) | ~5,000 | ~days to months |
| Argon2 | ~1,000 | ~weeks to years |

**Password hashing algorithms are intentionally slow.** That's the whole point.

## What is a Salt?

A **salt** is a random string added to the password before hashing. Each user gets a unique salt.

### Why Salting Matters

**Without salt (BAD):**
```
User Alice: hash("password123") → "abc123..."
User Bob:   hash("password123") → "abc123..."  ← SAME hash!
```

An attacker who cracks one hash immediately knows all users with the same password. Worse, they can use **rainbow tables** — pre-computed hash-to-password mappings.

**With salt (GOOD):**
```
User Alice: hash("password123" + "x7Km9p") → "def456..."
User Bob:   hash("password123" + "Rj2nQw") → "ghi789..."  ← DIFFERENT!
```

Even identical passwords produce different hashes. Rainbow tables become useless because every salt creates a unique hash space.

### Salt Properties
- **Random**: Cryptographically secure random bytes
- **Unique per password**: Each user/password gets its own salt
- **Not secret**: Salt is stored alongside the hash (it's in the bcrypt output string)
- **Long enough**: Minimum 16 bytes (128 bits)

```python
import os
import base64

# Generate a cryptographically secure salt
salt = os.urandom(16)  # 16 random bytes
print(base64.b64encode(salt))  # b'x7Km9pRj2nQw3kL1'
```

## bcrypt In Detail

bcrypt is the most widely used password hashing algorithm. Here's how it works internally.

### The bcrypt Algorithm

```
Input: password (up to 72 bytes), cost (4-31)

1. Generate 16-byte random salt

2. Derive encryption key:
   key = EksBlowfishSetup(cost, salt, password)
   
   This runs 2^cost iterations of the Blowfish key schedule
   For cost=12: 2^12 = 4,096 iterations
   For cost=14: 2^14 = 16,384 iterations

3. Encrypt the string "OrpheanBeholderScryDoubt" 
   using the derived key (64 rounds of Blowfish encryption)

4. Output: "$2b$" + cost + "$" + base64(salt) + base64(hash)
```

### The bcrypt Output Format

```
$2b$12$LJ3m9bK0QpGh1fE7Rk7v.OZB8tKxI3YxmDqN5vPpT6kR1nJ0V8pS2
│  │  │                       │
│  │  │                       └── Hash value (31 chars, base64)
│  │  └── Salt (22 chars, base64 of 16 bytes)
│  └── Cost factor (2^12 = 4,096 iterations)
└── Algorithm identifier ($2b = bcrypt, current version)
```

**Key insight:** The salt is embedded in the output. When verifying, bcrypt extracts the salt from the stored hash to re-hash the input password.

### Choosing the Cost Factor

The cost factor controls how slow hashing is. Higher = more secure but slower login.

| Cost | Iterations | Time per Hash | Use Case |
|------|-----------|---------------|----------|
| 10 | 1,024 | ~100ms | Minimum acceptable |
| 12 | 4,096 | ~250ms | **Recommended default** |
| 14 | 16,384 | ~1s | High security |
| 16 | 65,536 | ~4s | Very high security (slow login) |

```python
from passlib.context import CryptContext

# Configure bcrypt with cost factor 12 (default and recommended)
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,  # Cost factor — increase over time as hardware improves
)
```

**Rule of thumb:** Choose the highest cost that keeps login time under 250ms on your server. Increase by 1 every ~2 years as hardware improves.

## Password Verification Flow

When a user logs in, here's exactly what happens:

```
User submits: username="alice", password="MyP@ss123"
         │
         ▼
┌─────────────────────────────────────────┐
│ 1. Look up user in database             │
│    SELECT password_hash FROM users      │
│    WHERE username = 'alice'             │
│                                         │
│    Result: "$2b$12$LJ3m9bK0QpGh..."     │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 2. Extract salt from stored hash        │
│    Salt: "LJ3m9bK0QpGh1fE7Rk7v."       │
│    Cost: 12                             │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 3. Hash the submitted password          │
│    with the SAME salt and cost          │
│                                         │
│    bcrypt("MyP@ss123", salt, cost=12)   │
│    → "$2b$12$LJ3m9bK0QpGh...newHash"   │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 4. Compare hashes                       │
│    (constant-time comparison!)          │
│                                         │
│    Stored:  "$2b$12$LJ3m9b...OZB8t..." │
│    Computed:"$2b$12$LJ3m9b...OZB8t..." │
│                                         │
│    Match? → Login success               │
│    No match? → Login failed             │
└─────────────────────────────────────────┘
```

### Why Constant-Time Comparison?

Normal string comparison stops at the first different character. An attacker can measure response times to guess characters one by one (**timing attack**).

```python
# BAD: vulnerable to timing attack
if computed_hash == stored_hash:  # Stops early on mismatch
    return True

# GOOD: constant-time comparison (what passlib/bcrypt does internally)
import hmac
hmac.compare_digest(computed_hash, stored_hash)  # Always compares ALL bytes
```

## Password Hashing in Python (Complete Example)

```python
import bcrypt  # pip install bcrypt — the standard, actively maintained library

def hash_password(plain_password: str) -> str:
    """
    Hash a password for storage.
    
    What happens inside:
    1. bcrypt.gensalt() generates 16 random bytes (salt) with cost factor 12
    2. bcrypt.hashpw() runs the Blowfish key schedule 2^12 times
    3. Returns string: "$2b$12$<salt><hash>"
    """
    return bcrypt.hashpw(
        plain_password.encode("utf-8"),
        bcrypt.gensalt(rounds=12),  # cost factor — default is 12
    ).decode("utf-8")


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """
    Verify a password against its stored hash.
    
    What happens inside:
    1. Extract salt and cost from stored_hash
    2. Hash plain_password with same salt and cost
    3. Constant-time compare the result with stored_hash
    4. Return True if match, False otherwise
    """
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        stored_hash.encode("utf-8"),
    )


# Example usage
password = "MyP@ss123"

# Registration
hashed = hash_password(password)
print(f"Stored in DB: {hashed}")
# $2b$12$LJ3m9bK0QpGh1fE7Rk7v.OZB8tKxI3YxmDqN5vPpT6kR1nJ0V8pS2

# Login verification
assert verify_password("MyP@ss123", hashed) == True   # Correct password
assert verify_password("wrongpass", hashed) == False   # Wrong password

# Each call to hash produces a DIFFERENT result (different salt)
hash1 = hash_password("same_password")
hash2 = hash_password("same_password")
print(hash1 != hash2)  # True! Different salts → different hashes
# But both verify correctly:
assert verify_password("same_password", hash1) == True
assert verify_password("same_password", hash2) == True
```

> **Why `bcrypt` directly instead of `passlib`?** `passlib` (last released 2020) has compatibility issues with modern `bcrypt` versions and Python 3.13+. Using `bcrypt` directly is simpler, has no wrapper overhead, and is actively maintained.

## Algorithm Comparison

| Algorithm | Type | Salt | Memory-Hard | Best For |
|-----------|------|------|-------------|----------|
| **bcrypt** | CPU-hard | Built-in | No | General use (most popular) |
| **Argon2id** | CPU+Memory-hard | Built-in | Yes | Modern best practice |
| **scrypt** | CPU+Memory-hard | Separate | Yes | Cryptocurrency, high-security |
| **PBKDF2** | CPU-hard | Separate | No | Legacy compatibility (NIST approved) |
| SHA-256 | Fast hash | No | No | **Never use for passwords** |
| MD5 | Fast hash | No | No | **Never use for passwords** |

### When to Choose What

```python
# Option 1: bcrypt (safest choice — battle-tested, widely supported)
# pip install bcrypt
import bcrypt
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

# Option 2: Argon2 (modern best practice — use if your system supports it)
# pip install argon2-cffi
from argon2 import PasswordHasher
ph = PasswordHasher()
hashed = ph.hash(password)
ph.verify(hashed, password)  # Raises VerifyMismatchError on failure
```

### Migrating from bcrypt to Argon2

If you want to upgrade existing bcrypt hashes to Argon2 over time:

```python
import bcrypt
from argon2 import PasswordHasher

ph = PasswordHasher()

def verify_and_upgrade(plain_password: str, stored_hash: str) -> tuple[bool, str | None]:
    """Verify password, return (is_valid, new_hash_if_upgraded)."""
    
    # Check if it's a bcrypt hash (starts with $2b$)
    if stored_hash.startswith("$2b$"):
        is_valid = bcrypt.checkpw(plain_password.encode(), stored_hash.encode())
        if is_valid:
            # Re-hash with Argon2 for next time
            new_hash = ph.hash(plain_password)
            return True, new_hash  # Caller should UPDATE the DB
        return False, None
    
    # It's already an Argon2 hash
    try:
        ph.verify(stored_hash, plain_password)
        return True, None  # No upgrade needed
    except Exception:
        return False, None
```

## What NOT to Do

### 1. Don't Hash Passwords Yourself
```python
# NEVER DO THIS
import hashlib
stored = hashlib.sha256(password.encode()).hexdigest()  # No salt, too fast

# NEVER DO THIS EITHER
stored = hashlib.sha256((password + "static_salt").encode()).hexdigest()  # Reused salt
```

### 2. Don't Use Encryption for Passwords
```python
# WRONG: Encryption is reversible — if key is stolen, all passwords are exposed
from cryptography.fernet import Fernet
key = Fernet.generate_key()
encrypted = Fernet(key).encrypt(password.encode())  # Can be decrypted!
```

### 3. Don't Truncate Passwords
```python
# WRONG: bcrypt has a 72-byte limit, but don't silently truncate
# Instead, pre-hash long passwords:
import hashlib
import base64

def hash_long_password(password: str) -> str:
    """Pre-hash with SHA-256 if password > 72 bytes, then bcrypt."""
    if len(password.encode('utf-8')) > 72:
        password = base64.b64encode(
            hashlib.sha256(password.encode()).digest()
        ).decode()
    return pwd_context.hash(password)
```

### 4. Don't Log Passwords
```python
# NEVER log passwords, even in debug mode
logger.debug(f"Login attempt: {username}, {password}")  # TERRIBLE

# Do this instead
logger.info(f"Login attempt: {username}")
```

## Database Schema for Password Storage

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    
    -- Store ONLY the hash, never plaintext
    -- bcrypt output is always 60 characters
    password_hash TEXT NOT NULL,
    
    -- Track password changes
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Failed login tracking (for brute force protection)
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast username lookups during login
CREATE INDEX idx_users_username ON users(username);
```

## Security Checklist

- [ ] Using bcrypt or Argon2 (not SHA-256, MD5, or plain text)
- [ ] Cost factor ≥ 12 for bcrypt
- [ ] Unique salt per password (automatic with bcrypt/argon2)
- [ ] Constant-time comparison (automatic with passlib)
- [ ] No password logging anywhere in the application
- [ ] HTTPS for all auth endpoints (passwords in transit)
- [ ] Failed login attempt tracking and account lockout
- [ ] Password minimum length requirement (8+ characters)
- [ ] Not truncating passwords silently
- [ ] Storing only the hash in the database
