import CodeBlock from '../../../components/CodeBlock'
import Diagram, { FlowStep, InfoBox, ComparisonTable } from '../../../components/Diagram'
import MermaidDiagram from '../../../components/MermaidDiagram'

export default function Project1() {
  return (<>
    {/* ── Problem Statement ────────────────────────────── */}
    <Section title="The Problem">
      <P>You're building an API. Anyone can call any endpoint. There's no way to know who's making a request, and no way to restrict access. You need the most fundamental building block of web security: <strong>user authentication</strong>.</P>
      <P>Specifically, you need to answer four questions:</P>
      <ol className="list-decimal list-inside space-y-2 text-[var(--color-text-secondary)] ml-4 mb-6">
        <li>How do you safely store a user's password? (You <em>never</em> store the actual password.)</li>
        <li>How do you verify their identity when they log in?</li>
        <li>How do you "remember" they're logged in for subsequent requests without asking for their password every time?</li>
        <li>How do you prevent someone from brute-forcing passwords by trying thousands of combinations?</li>
      </ol>
      <P>This project solves all four. By the end, you'll have a working auth system with registration, login, JWT tokens, protected routes, and account lockout — the same patterns used by real production APIs.</P>
    </Section>

    {/* ── Architecture ────────────────────────────────── */}
    <Section title="Architecture">
      <P>The system has three layers: a frontend (vanilla HTML/JS), a FastAPI backend, and a SQLite database. The frontend sends requests, the backend handles all auth logic, and the database stores users and their hashed passwords.</P>

      <MermaidDiagram title="Project 1 — System architecture" chart={`sequenceDiagram
    participant F as 🌐 Frontend<br/>(HTML/JS)
    participant B as 🖥️ FastAPI<br/>(Port 8000)
    participant DB as 🗄️ SQLite<br/>(users.db)

    Note over F,DB: Registration Flow
    F->>B: POST /api/register {username, email, password}
    B->>B: hash = bcrypt.hashpw(password, salt)
    B->>DB: INSERT INTO users (username, email, password_hash)
    B-->>F: 201 {id, username, email}

    Note over F,DB: Login Flow
    F->>B: POST /api/login {username, password}
    B->>DB: SELECT * FROM users WHERE username=?
    B->>B: bcrypt.checkpw(password, stored_hash)
    alt Password correct
        B->>B: token = jwt.encode({sub: username}, SECRET)
        B-->>F: 200 {access_token: "eyJ..."}
    else Wrong password
        B->>DB: UPDATE failed_login_attempts += 1
        B-->>F: 401 "Invalid credentials"
    end

    Note over F,DB: Protected Request
    F->>B: GET /api/me + Authorization: Bearer eyJ...
    B->>B: jwt.decode(token) → {sub: "alice"}
    B->>DB: SELECT id, username, email WHERE username="alice"
    B-->>F: 200 {id: 1, username: "alice", email: "..."}`} />
    </Section>

    {/* ── File Structure ────────────────────────────────── */}
    <Section title="File Structure">
      <P>The project has 5 Python files and 1 HTML file. Each file has a single clear responsibility:</P>
      <ComparisonTable headers={['File', 'Responsibility', 'Key Functions']} rows={[
        ['database.py', 'SQLite connection + schema setup', 'get_db(), init_db()'],
        ['models.py', 'Pydantic request/response validation', 'UserRegister, UserLogin, Token'],
        ['auth.py', 'Password hashing + JWT logic', 'hash_password(), verify_password(), create_access_token(), get_current_user()'],
        ['main.py', 'API endpoints + account lockout', '/register, /login, /me, /protected'],
        ['test_project1.py', '45 tests — unit, integration, E2E', 'TestPasswordHashing, TestLoginEndpoint, TestAccountLockout, ...'],
        ['frontend/index.html', 'Login/register UI + token management', 'Login tab, register tab, profile view'],
      ]} />
    </Section>

    {/* ── Step-by-Step Walkthrough ────────────────────── */}
    <Section title="Step-by-Step Code Walkthrough">
      <h3 className="text-lg font-semibold mt-8 mb-3 text-[var(--color-text)]">Step 1: Database Schema</h3>
      <P>First, we define where user data lives. The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">password_hash</code> column stores the bcrypt output — never the plaintext password. The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">failed_login_attempts</code> and <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">locked_until</code> columns support account lockout.</P>

      <CodeBlock title="database.py — Schema definition" language="python" code={`import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "users.db"

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # Access columns by name
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,          -- bcrypt output, never plaintext
            failed_login_attempts INTEGER DEFAULT 0,  -- for lockout
            locked_until TIMESTAMP,                    -- NULL = not locked
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()`} />

      <h3 className="text-lg font-semibold mt-10 mb-3 text-[var(--color-text)]">Step 2: Password Hashing & JWT Utilities</h3>
      <P>This is the security core. Two functions handle passwords (hash and verify), and two handle JWT tokens (create and decode). The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">get_current_user</code> function is a FastAPI dependency — it automatically extracts the token from the Authorization header, verifies it, and returns the user.</P>

      <CodeBlock title="auth.py — The complete auth utilities" language="python" code={`import os
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# ── Password Functions ──────────────────────────────

def hash_password(password: str) -> str:
    """Generate salt + hash. Each call produces different output."""
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()            # Random 16-byte salt
    ).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    """Extract salt from stored hash, re-hash input, compare."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# ── JWT Functions ───────────────────────────────────

def create_access_token(data: dict, expires_delta=None) -> str:
    """Create a signed JWT with user claims + expiry."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    """Verify signature + check expiry. Raises on failure."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── FastAPI Dependency ──────────────────────────────

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Extracts token from 'Authorization: Bearer xxx' header,
    decodes it, looks up the user in the database."""
    payload = decode_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    from database import get_db
    conn = get_db()
    user = conn.execute(
        "SELECT id, username, email FROM users WHERE username = ?",
        (username,)
    ).fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)`} />

      <h3 className="text-lg font-semibold mt-10 mb-3 text-[var(--color-text)]">Step 3: Registration Endpoint</h3>
      <P>Registration takes a username, email, and password. It checks for duplicates, hashes the password with bcrypt, stores the hash (never the plaintext), and returns the new user profile.</P>

      <CodeBlock title="main.py — Registration" language="python" code={`@app.post("/api/register", response_model=UserResponse, status_code=201)
def register(user: UserRegister):
    conn = get_db()

    # Check if username or email already exists
    existing = conn.execute(
        "SELECT id FROM users WHERE username = ? OR email = ?",
        (user.username, user.email)
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(400, "Username or email already exists")

    # Hash the password — NEVER store plaintext
    password_hash = hash_password(user.password)

    # Insert user with hashed password
    cursor = conn.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        (user.username, user.email, password_hash)
    )
    conn.commit()
    new_user = conn.execute(
        "SELECT id, username, email FROM users WHERE id = ?",
        (cursor.lastrowid,)
    ).fetchone()
    conn.close()
    return dict(new_user)  # Returns {id, username, email} — no password!`} />

      <h3 className="text-lg font-semibold mt-10 mb-3 text-[var(--color-text)]">Step 4: Login with Account Lockout</h3>
      <P>This is the most complex endpoint. It handles three scenarios: account already locked, wrong password (increment counter, maybe lock), and correct password (reset counter, issue JWT).</P>

      <CodeBlock title="main.py — Login with brute-force protection" language="python" code={`MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

@app.post("/api/login", response_model=Token)
def login(user: UserLogin):
    conn = get_db()
    db_user = conn.execute(
        "SELECT id, username, password_hash, failed_login_attempts, locked_until "
        "FROM users WHERE username = ?",
        (user.username,)
    ).fetchone()

    if not db_user:
        conn.close()
        raise HTTPException(401, "Invalid username or password")

    # ── Check if account is locked ──
    if db_user["locked_until"]:
        locked_until = datetime.fromisoformat(db_user["locked_until"])
        if locked_until > datetime.now(timezone.utc):
            conn.close()
            raise HTTPException(423, "Account locked. Try again later.")
        else:
            # Lock expired — reset
            conn.execute("UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=?",
                         (db_user["id"],))
            conn.commit()

    # ── Verify password ──
    if not verify_password(user.password, db_user["password_hash"]):
        attempts = (db_user["failed_login_attempts"] or 0) + 1
        if attempts >= MAX_FAILED_ATTEMPTS:
            # Lock the account
            lock_until = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
            conn.execute("UPDATE users SET failed_login_attempts=?, locked_until=? WHERE id=?",
                         (attempts, lock_until, db_user["id"]))
        else:
            conn.execute("UPDATE users SET failed_login_attempts=? WHERE id=?",
                         (attempts, db_user["id"]))
        conn.commit()
        conn.close()
        raise HTTPException(401, "Invalid username or password")

    # ── Success — reset counter, issue JWT ──
    conn.execute("UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=?",
                 (db_user["id"],))
    conn.commit()
    conn.close()
    access_token = create_access_token(data={"sub": db_user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}`} />

      <h3 className="text-lg font-semibold mt-10 mb-3 text-[var(--color-text)]">Step 5: Protected Endpoints</h3>
      <P>Any endpoint that needs authentication just adds <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Depends(get_current_user)</code>. FastAPI automatically extracts the Bearer token, verifies it, and passes the user data to your function. If the token is missing or invalid, the user gets a 401 before your code runs.</P>

      <CodeBlock title="main.py — Protected routes" language="python" code={`@app.get("/api/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """The 'current_user' is already verified — JWT was valid."""
    return current_user

@app.get("/api/protected")
def protected_route(current_user: dict = Depends(get_current_user)):
    return {
        "message": f"Hello {current_user['username']}! You have access.",
        "user_id": current_user["id"],
    }

# Without a valid token:
# GET /api/me → 401 {"detail": "Not authenticated"}

# With a valid token:
# GET /api/me + Authorization: Bearer eyJ...
# → 200 {"id": 1, "username": "alice", "email": "alice@test.com"}`} />
    </Section>

    {/* ── Testing ────────────────────────────────── */}
    <Section title="Testing — 45 Tests">
      <P>The test suite covers every scenario: happy paths, edge cases, and security boundaries. Here are the test categories:</P>

      <ComparisonTable headers={['Category', 'Tests', 'What they verify']} rows={[
        ['Password Hashing', '7', 'bcrypt output format, different salts per call, special characters, unicode, empty password rejection'],
        ['JWT Tokens', '7', 'Token creation, decoding, expiry, tampered tokens, wrong secret, missing claims'],
        ['Registration', '5', 'Success, duplicate username, duplicate email, hashed storage, missing fields'],
        ['Login', '5', 'Success, wrong password, nonexistent user, valid JWT returned, empty password'],
        ['Account Lockout', '3', 'Locks after 5 failures, correct login resets counter, locked account rejects correct password'],
        ['Protected Endpoints', '6', 'Valid token works, no token = 401, invalid token = 401, expired token = 401'],
        ['E2E Flows', '4', 'Full register→login→access flow, multiple user isolation, cross-user token check'],
        ['Edge Cases', '8', 'Wrong secret key, missing sub claim, deleted user, empty auth header, long username, special chars'],
      ]} />

      <CodeBlock title="Key test examples" language="python" code={`class TestAccountLockout:
    def test_account_locks_after_max_attempts(self):
        register_user()
        for _ in range(5):
            login_user(password="wrong")      # 5 wrong attempts
        res = login_user(password="TestPass123")  # Correct password
        assert res.status_code == 423             # Still locked!
        assert "locked" in res.json()["detail"].lower()

    def test_correct_password_resets_counter(self):
        register_user()
        login_user(password="wrong")
        login_user(password="wrong")
        res = login_user()                        # Correct = resets counter
        assert res.status_code == 200
        # Now need 5 MORE failures to lock again
        for _ in range(4):
            login_user(password="wrong")
        res = login_user()                        # Still works (only 4 failures)
        assert res.status_code == 200

class TestEdgeCases:
    def test_token_with_wrong_secret(self):
        """Token signed with a different secret is rejected."""
        token = jwt.encode({"sub": "alice", "exp": ...}, "wrong-secret")
        res = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 401`} />
    </Section>

    {/* ── What You Learned ────────────────────────────── */}
    <Section title="What You've Learned">
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { num: '01', text: 'Passwords are NEVER stored — only the bcrypt hash. Each hash includes its own random salt.' },
          { num: '02', text: 'JWT tokens are self-contained — the server doesn\'t store sessions. The token itself proves identity.' },
          { num: '03', text: 'The Depends(get_current_user) pattern lets you protect any endpoint with one line of code.' },
          { num: '04', text: 'Account lockout tracks failed_login_attempts in the database and locks after 5 failures for 15 minutes.' },
          { num: '05', text: 'Tests should cover not just happy paths, but edge cases: expired tokens, tampered tokens, locked accounts.' },
          { num: '06', text: 'The frontend stores the JWT in a JavaScript variable (not localStorage) and sends it via the Authorization header.' },
        ].map(item => (
          <div key={item.num} className="flex gap-3 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
            <span className="text-[var(--color-primary)] font-bold font-mono text-sm flex-shrink-0">{item.num}</span>
            <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.text}</span>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Common Mistakes & Debugging">
      <ComparisonTable headers={['Problem', 'Symptom', 'Cause', 'Fix']} rows={[
        ['401 on every request', 'GET /api/me always returns 401', 'Authorization header missing or malformed', 'Check: header must be exactly "Bearer eyJ..." with a space after Bearer'],
        ['Registration works but login fails', '401 on login with correct password', 'Password stored as plaintext, not bcrypt hash', 'Ensure hash_password() is called before INSERT, not the raw password'],
        ['Token works once then fails', 'First request OK, second returns 401', 'Creating a new token on every request instead of reusing the login token', 'Store the token from /login response and reuse it'],
        ['Account locked but password is correct', '423 Locked response', 'Previous failed attempts triggered lockout', 'Wait 15 minutes, or reset in DB: UPDATE users SET failed_login_attempts=0, locked_until=NULL'],
        ['"Invalid token" after server restart', '401 even with a recently-issued token', 'SECRET_KEY changed (using random default)', 'Set a fixed SECRET_KEY in .env — random defaults change on restart'],
        ['bcrypt error on Python 3.13', 'ValueError or AttributeError from passlib', 'Using passlib instead of bcrypt directly', 'We use bcrypt directly (not passlib) to avoid this — check your imports'],
      ]} />
    </Section>

    <InfoBox type="tip" title="What's missing?">
      This project uses <strong>HS256</strong> (symmetric JWT) — the same secret signs and verifies. If you deploy multiple servers, they'd all need the same secret. Project 2 solves this with RS256 (asymmetric). This project also has no way to revoke tokens or reset passwords — those come in Projects 2 and 3.
    </InfoBox>
  </>)
}

function Section({ title, children }) {
  return (
    <section className="mt-12 mb-8">
      <h2 className="text-2xl font-bold mb-4 text-[var(--color-text)]">{title}</h2>
      {children}
    </section>
  )
}

function P({ children }) {
  return <p className="text-[var(--color-text-secondary)] leading-[1.8] text-[15px] mb-5">{children}</p>
}
