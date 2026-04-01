import CodeBlock from '../../components/CodeBlock'
import Diagram, { FlowStep, InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import Exercise from '../../components/Exercise'
import { Hash } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter6() {
  return (<>
    <H icon={Hash} title="Password Hashing & Storage" badge="Chapter 6 · Core" color="primary" />

    <P>Let's start with a horror story. In 2012, LinkedIn was hacked. 6.5 million passwords were leaked. But it wasn't because attackers cracked some clever encryption — LinkedIn had stored passwords as <strong>unsalted SHA-1 hashes</strong>. Attackers cracked most of them within hours using rainbow tables (pre-computed hash-to-password lookups).</P>

    <P>The lesson: how you store passwords is one of the most critical security decisions you'll make. Get it wrong, and one database breach exposes every user. Get it right, and even if your database leaks, the passwords are practically unrecoverable.</P>

    <Section title="The Golden Rule">
      <P>You should <strong>never</strong> store a password. Not in plaintext, not "encrypted," not as a simple hash. Instead, you store the output of a <strong>password hashing function</strong> — a one-way transformation that cannot be reversed. When a user logs in, you re-hash their input and compare the results.</P>

      <P>Let's trace the entire lifecycle of a password, from the moment a user types it to how it's verified on login.</P>
    </Section>

    <Section title="Registration: Storing the Password">
      <div className="border-l-2 border-emerald-400 pl-5 ml-2 space-y-0">
        <FlowStep number="1" title='User types "MyP@ss123"' color="green">
          The plaintext password exists only in memory, briefly. It's received in the request body, used once, and never stored. It should never appear in logs, error messages, or debug output.
        </FlowStep>
        <FlowStep number="2" title="Generate a random salt — 16 bytes of cryptographic randomness" color="green">
          The salt is unique to this specific password entry. Even if two users choose the same password, they'll get different salts and therefore different hashes. This is what defeated LinkedIn — had they used salts, rainbow tables wouldn't have worked.
        </FlowStep>
        <FlowStep number="3" title="Run bcrypt with cost factor 12" color="green">
          bcrypt takes the password and salt, then runs the Blowfish cipher's key schedule <strong>4,096 times</strong> (2^12). This is intentionally slow — about 250ms on a modern server. That's imperceptible to a user logging in, but devastating to an attacker trying billions of combinations.
        </FlowStep>
        <FlowStep number="4" title="Store the hash string in the database" color="green">
          The output is a single string like <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">$2b$12$LJ3m9bK0Qp...OZB8tKxI3Yx</code>. This contains the algorithm version, cost factor, salt, and hash — all in one string. The original password is gone forever.
        </FlowStep>
      </div>
    </Section>

    <Section title="The bcrypt Output — Decoded">
      <Diagram title="Every field is embedded in the output string">
{`$2b$12$LJ3m9bK0QpGh1fE7Rk7v.OZB8tKxI3YxmDqN5vPpT6kR1nJ0V8pS2
 │   │  │                       │
 │   │  │                       └── Hash (31 chars, base64)
 │   │  └── Salt (22 chars = base64 of 16 random bytes)
 │   └── Cost factor (12 means 2¹² = 4,096 iterations)
 └── Algorithm ($2b = bcrypt, current version)`}
      </Diagram>

      <P>Notice that the <strong>salt is not secret</strong>. It's right there in the hash string, stored in the database alongside the hash. Its purpose isn't to be hidden — it's to make each hash unique, so identical passwords produce different outputs. This defeats pre-computed attacks (rainbow tables).</P>
    </Section>

    <Section title="Login: Verifying the Password">
      <MermaidDiagram title="How password verification actually works" chart={`sequenceDiagram
    participant U as 👤 User
    participant S as 🖥️ Server
    participant DB as 🗄️ Database
    U->>S: POST /login {"password": "MyP@ss123"}
    S->>DB: SELECT password_hash WHERE username='alice'
    DB-->>S: "$2b$12$LJ3m9bK0Qp..."
    Note over S: 1. Extract salt from stored hash<br/>   → "LJ3m9bK0QpGh1fE7Rk7v."<br/>2. Extract cost factor → 12<br/>3. Re-hash input: bcrypt("MyP@ss123", salt, 12)<br/>4. Compare ALL bytes (constant-time)
    alt Computed hash matches stored hash
        S-->>U: ✅ 200 OK + JWT access token
    else Hashes don't match
        S-->>U: ❌ 401 Invalid credentials
    end`} />

      <P>The key insight: bcrypt doesn't "decrypt" the stored hash. That's impossible (it's one-way). Instead, it re-hashes the submitted password using the same salt and cost factor from the stored hash, then compares the results. If they match, the password is correct.</P>
    </Section>

    <Section title="Why Speed Is the Enemy">
      <P>SHA-256 computes about <strong>10 billion hashes per second</strong> on a modern GPU. If an attacker gets your database, they can try every 8-character password in under a day. bcrypt was designed to be <strong>intentionally slow</strong> — about 5,000 hashes per second on the same GPU. That turns "hours" into "centuries."</P>

      <ComparisonTable headers={['Algorithm', 'GPU Speed', 'Time to crack "password123"', 'Verdict']} rows={[
        ['SHA-256', '10 billion/sec', '< 1 second', '🚫 Never use for passwords'],
        ['MD5', '25 billion/sec', '< 1 second', '🚫 Even worse'],
        ['bcrypt (cost=12)', '~5,000/sec', 'Days to months', '✅ Recommended'],
        ['Argon2id', '~1,000/sec', 'Weeks to years', '✅ Modern best practice'],
      ]} />
    </Section>

    <Section title="The Code">
      <CodeBlock title="auth.py — What we use in all 3 projects" language="python" code={`import bcrypt

def hash_password(password: str) -> str:
    """Hash a password for storage.

    What happens inside:
    1. bcrypt.gensalt() generates 16 random bytes
    2. bcrypt.hashpw() runs Blowfish key schedule 4,096 times
    3. Returns "$2b$12$<salt><hash>" — all info in one string
    """
    return bcrypt.hashpw(
        password.encode("utf-8"),   # Must be bytes, not string
        bcrypt.gensalt(rounds=12),  # Cost factor: 2^12 = 4,096 iterations
    ).decode("utf-8")              # Store as string in database

def verify_password(plain: str, stored_hash: str) -> bool:
    """Verify a password against its stored hash.

    What happens inside:
    1. Extracts salt and cost from stored_hash (first 29 chars)
    2. Re-hashes 'plain' with the SAME salt and cost
    3. Constant-time comparison of all bytes (prevents timing attacks)
    """
    return bcrypt.checkpw(
        plain.encode("utf-8"),
        stored_hash.encode("utf-8"),
    )

# Important: each call produces a DIFFERENT hash (different salt)
h1 = hash_password("same_password")  # "$2b$12$abc..."
h2 = hash_password("same_password")  # "$2b$12$xyz..." ← Different!
# But both verify correctly:
assert verify_password("same_password", h1) == True
assert verify_password("same_password", h2) == True`} />
    </Section>

    <Section title="What About Constant-Time Comparison?">
      <P>Normal string comparison (==) stops at the first different character. An attacker could measure the response time to figure out how many characters are correct — this is called a <strong>timing attack</strong>. bcrypt's checkpw function uses constant-time comparison internally, always comparing ALL bytes regardless of how early a mismatch occurs. You don't need to worry about this — bcrypt handles it for you.</P>

      <InfoBox type="danger" title="Three things to never do">
        <strong>1.</strong> <code className="text-xs font-mono">hashlib.sha256(password).hexdigest()</code> — No salt, absurdly fast.<br/>
        <strong>2.</strong> <code className="text-xs font-mono">Fernet(key).encrypt(password)</code> — Encryption is reversible. If the key leaks, all passwords are exposed.<br/>
        <strong>3.</strong> <code className="text-xs font-mono">logger.debug(f"Login: {'{'}username{'}'}, {'{'}password{'}'}")</code> — Never log passwords, even in debug mode.
      </InfoBox>

      <Exercise
        title="Try it yourself: Password Hashing"
        difficulty="medium"
        tasks={[
          'Open a Python shell and run: import bcrypt; print(bcrypt.hashpw(b"test", bcrypt.gensalt()).decode())',
          'Run it again with the same password — verify the output is DIFFERENT (different salt)',
          'Try changing the cost factor: bcrypt.gensalt(rounds=14) — notice it takes longer',
          'Verify both hashes: bcrypt.checkpw(b"test", hash1) and bcrypt.checkpw(b"test", hash2) — both should return True',
          'Try bcrypt.checkpw(b"wrong", hash1) — should return False',
          'Look at the hash output and identify the algorithm ($2b$), cost factor, salt, and hash portions',
        ]}
        hints={[
          'Install bcrypt: pip install bcrypt',
          'Cost 12 ≈ 250ms, cost 14 ≈ 1 second. You\'ll feel the difference.',
          'The salt is characters 8-29 of the hash string',
        ]}
      />
    </Section>
  </>)
}
