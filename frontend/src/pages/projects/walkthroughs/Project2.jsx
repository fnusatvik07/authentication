import CodeBlock from '../../../components/CodeBlock'
import Diagram, { FlowStep, InfoBox, ComparisonTable } from '../../../components/Diagram'
import MermaidDiagram from '../../../components/MermaidDiagram'

export default function Project2() {
  return (<>
    <Section title="The Problem">
      <P>Project 1 works for a single server. But real applications often have multiple services - an auth server, a resource server, maybe a payment server. They all need to verify JWT tokens. With HS256, that means sharing the same secret key across every server. If <em>any</em> server is compromised, the attacker can forge tokens for any user.</P>
      <P>This project introduces three upgrades that take your auth system from "works on my laptop" to "production architecture":</P>
      <ol className="list-decimal list-inside space-y-2 text-[var(--color-text-secondary)] ml-4 mb-6">
        <li><strong>RS256 asymmetric JWT</strong> - Private key signs tokens on the auth server. Resource servers verify with the public key (and can't forge).</li>
        <li><strong>RBAC with resource-level access</strong> - Users have roles (user/admin/super_admin). Each resource in the database has an access level. Users only see what their role permits.</li>
        <li><strong>Password reset</strong> - Secure token-based flow for "forgot password," plus account lockout with remaining-attempts feedback.</li>
      </ol>
    </Section>

    <Section title="Architecture - Two Servers">
      <P>Unlike Project 1 (single server), this project runs <strong>two separate servers</strong>. The auth server (port 8000) handles identity - registration, login, tokens, user management. The resource server (port 8001) serves protected data. They communicate through JWT tokens, but critically, they have <em>different</em> keys.</P>

      <MermaidDiagram title="Two-server architecture with RS256" chart={`sequenceDiagram
    participant F as 🌐 Frontend
    participant A as 🔐 Auth Server<br/>Port 8000<br/>(PRIVATE key)
    participant R as 🌍 Resource Server<br/>Port 8001<br/>(PUBLIC key only)
    participant DB1 as 🗄️ users.db
    participant DB2 as 🗄️ resources.db

    Note over F,DB2: Login
    F->>A: POST /login {username, password}
    A->>DB1: Verify bcrypt + check lockout
    A->>A: jwt.encode(payload, PRIVATE_KEY, "RS256")
    A-->>F: {access_token, refresh_token}

    Note over F,DB2: Access resources
    F->>R: GET /resources + Bearer token
    R->>R: jwt.decode(token, PUBLIC_KEY, "RS256")
    Note over R: Extract role from JWT<br/>Filter resources by role
    R->>DB2: SELECT * WHERE access_level IN (allowed_levels)
    R-->>F: [resources user is allowed to see]

    Note over F,DB2: Password Reset
    F->>A: POST /password-reset/request {email}
    A->>DB1: Generate token, store hash
    A-->>F: {reset_token} (in prod: sent via email)
    F->>A: POST /password-reset/confirm {token, new_password}
    A->>DB1: Verify token, update password_hash`} />
    </Section>

    <Section title="File Structure">
      <ComparisonTable headers={['Server', 'File', 'Responsibility']} rows={[
        ['Auth', 'keys.py', 'RSA key pair generation (private.pem + public.pem)'],
        ['Auth', 'auth.py', 'RS256 JWT signing, bcrypt hashing, RBAC role checker'],
        ['Auth', 'database.py', 'Users table + refresh tokens + password reset tokens'],
        ['Auth', 'models.py', 'Pydantic models including PasswordResetRequest/Confirm'],
        ['Auth', 'main.py', 'All auth endpoints: register, login, refresh, reset, user management'],
        ['Resource', 'database.py', 'Resources table with access_level column, seeded data'],
        ['Resource', 'main.py', 'RBAC-filtered resource endpoints, RS256 verification'],
        ['Both', 'test_project2.py', '58 tests covering RS256, RBAC, lockout, password reset, cross-server'],
      ]} />
    </Section>

    <Section title="RS256 - Key Generation & Usage">
      <P>The first thing that happens when you start the auth server is RSA key generation. If no keys exist, it creates a 2048-bit RSA key pair and saves them to disk.</P>

      <CodeBlock title="keys.py - RSA key pair generation" language="python" code={`from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from pathlib import Path

KEYS_DIR = Path(__file__).parent / "jwt_keys"

def generate_rsa_keys():
    KEYS_DIR.mkdir(exist_ok=True)
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    # Private key - stays on auth server, NEVER shared
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    (KEYS_DIR / "private.pem").write_bytes(private_pem)

    # Public key - safe to distribute to ALL resource servers
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    (KEYS_DIR / "public.pem").write_bytes(public_pem)`} />

      <P>The auth server <strong>signs</strong> tokens with the private key. The resource server <strong>verifies</strong> with the public key. The critical security property: the resource server <em>cannot forge tokens</em>, even if it's completely compromised.</P>

      <CodeBlock title="auth.py - RS256 signing and verification" language="python" code={`from keys import load_private_key, load_public_key

PRIVATE_KEY = load_private_key()  # Auth server only
PUBLIC_KEY = load_public_key()    # Both servers

ALGORITHM = "RS256"

def create_access_token(data: dict) -> str:
    """Sign with PRIVATE key - only auth server can do this."""
    to_encode = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(hours=1)
    to_encode["type"] = "access"
    return jwt.encode(to_encode, PRIVATE_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict:
    """Verify with PUBLIC key - any server can do this."""
    payload = jwt.decode(token, PUBLIC_KEY, algorithms=[ALGORITHM])
    if payload.get("type") != "access":
        raise HTTPException(401, "Invalid token type")
    return payload`} />

      <P>The auth server also exposes the public key via an API endpoint, so resource servers can fetch it dynamically:</P>

      <CodeBlock title="Public key endpoint" language="python" code={`@app.get("/api/public-key")
def get_public_key():
    """Resource servers call this to get the verification key.
    100% safe to expose - it can verify tokens but NOT create them."""
    return {"public_key": PUBLIC_KEY.decode("utf-8"), "algorithm": "RS256"}`} />
    </Section>

    <Section title="RBAC - Role-Based Resource Filtering">
      <P>The resource server stores 15 sample resources, each with an access level: public, user, admin, or super_admin. When a user requests resources, the server decodes their JWT, extracts their role, and filters the results.</P>

      <MermaidDiagram title="What each role can see" chart={`flowchart LR
    subgraph Resources["Resources Database"]
        P["3 public<br/>Company info, FAQs"]
        U["4 user-level<br/>Handbooks, roadmaps"]
        A["4 admin-level<br/>Costs, security"]
        SA["4 super_admin<br/>Board notes, salary"]
    end

    User["user role"] -.->|"can see"| P
    User -.-> U
    Admin["admin role"] -.-> P
    Admin -.-> U
    Admin -.-> A
    Super["super_admin"] -.-> P
    Super -.-> U
    Super -.-> A
    Super -.-> SA

    style P fill:#ecfdf5,stroke:#059669
    style U fill:#eef2ff,stroke:#6366f1
    style A fill:#fffbeb,stroke:#d97706
    style SA fill:#fef2f2,stroke:#dc2626`} />

      <CodeBlock title="Resource server - RBAC filtering" language="python" code={`ROLE_HIERARCHY = {"user": 1, "admin": 2, "super_admin": 3}
ACCESS_LEVEL_TO_ROLE = {"public": 0, "user": 1, "admin": 2, "super_admin": 3}

def get_accessible_levels(user_role: str) -> list[str]:
    """Return access levels the user can see based on their role."""
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    return [level for level, req in ACCESS_LEVEL_TO_ROLE.items()
            if req <= user_level]

@app.get("/api/resources")
def list_resources(current_user = Depends(get_current_user)):
    role = current_user.get("role", "user")
    accessible = get_accessible_levels(role)  # e.g., ["public", "user"] for role=user

    resources = db.execute(
        "SELECT * FROM resources WHERE access_level IN (?)",
        accessible  # Server-side filtering - client never sees restricted data
    )
    return {"role": role, "accessible_levels": accessible, "resources": resources}`} />
    </Section>

    <Section title="Password Reset Flow">
      <P>The password reset has two endpoints. The first generates a secure random token and stores its hash. The second accepts the token + new password, verifies the hash matches, and updates the password.</P>

      <div className="border-l-2 border-purple-400 pl-5 ml-2 space-y-0">
        <FlowStep number="1" title="User requests reset" color="purple">
          <code className="text-xs font-mono">POST /api/password-reset/request {`{"email": "alice@example.com"}`}</code>
          <br/>Server generates <code className="text-xs font-mono">secrets.token_urlsafe(32)</code>, stores SHA-256 hash in DB with 1-hour expiry. Returns raw token (in production: send via email).
        </FlowStep>
        <FlowStep number="2" title="User confirms reset" color="purple">
          <code className="text-xs font-mono">POST /api/password-reset/confirm {`{"reset_token": "abc...", "new_password": "NewPass"}`}</code>
          <br/>Server hashes the submitted token, looks up the hash. Checks: exists? not used? not expired? If valid: update password_hash, mark token as used, clear lockout.
        </FlowStep>
      </div>

      <InfoBox type="info" title="Anti-enumeration">
        The request endpoint returns the same message whether the email exists or not: "If the email exists, a reset link has been sent." This prevents attackers from discovering which emails are registered.
      </InfoBox>
    </Section>

    <Section title="Testing - 58 Tests">
      <ComparisonTable headers={['Category', 'Tests', 'What they verify']} rows={[
        ['Role Hierarchy', '5', 'Ordering, higher-passes-lower, lower-denied-higher, exact match'],
        ['Refresh Tokens', '4', 'Uniqueness, length, hash determinism, rotation'],
        ['Token Claims', '3', 'RS256 algorithm, role in token, expiry present'],
        ['Registration', '4', 'Default role=user, cannot self-assign admin, duplicate rejection'],
        ['Login', '4', 'Both tokens returned, role in JWT, deactivated user rejected, seeded admin works'],
        ['Account Lockout', '3', 'Locks after 5 failures, correct login resets, shows remaining attempts'],
        ['Password Reset', '6', 'Token generation, unknown email safe, full flow, single-use, expired token, clears lockout'],
        ['RS256', '3', 'Token uses RS256 algorithm, verifiable with public key, public-key endpoint works'],
        ['Resource Access', '8', 'User sees public+user only, admin sees more, super_admin sees all, forbidden for unauthorized'],
        ['E2E Flows', '4', 'Full lifecycle, role upgrade unlocks resources, cross-server token validation'],
      ]} />
    </Section>

    <Section title="What You've Learned">
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { num: '01', text: 'RS256 means the auth server signs with a private key, and resource servers verify with the public key. Compromised resource servers cannot forge tokens.' },
          { num: '02', text: 'RBAC filtering happens SERVER-SIDE. The database query itself filters by role. The client never receives data it shouldn\'t see.' },
          { num: '03', text: 'Refresh token rotation revokes the old token every time. If an attacker steals a token, it\'s only usable once.' },
          { num: '04', text: 'Password reset uses separate random tokens (not JWTs), stored as hashes, single-use, with time expiry.' },
          { num: '05', text: 'The public key endpoint lets resource servers dynamically fetch the verification key - no secret sharing needed.' },
          { num: '06', text: 'Account lockout now shows "3 attempts remaining" - better UX than a sudden lock.' },
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
        ['Resource server can\'t verify tokens', '401 on all resource server requests', 'Public key not found or wrong path', 'Run auth server first (generates keys), check jwt_keys/public.pem exists'],
        ['Token from auth server rejected by resource server', 'jwt.InvalidSignatureError', 'Servers using different algorithms (HS256 vs RS256)', 'Both must use RS256. Check ALGORITHM constant in both servers'],
        ['Password reset token "already used"', '400 error on second reset attempt', 'Tokens are single-use by design', 'Request a new reset token - each one can only be used once'],
        ['User role didn\'t change after admin update', 'Still seeing old resources', 'JWT still has old role - need to re-login', 'After role change, user must login again to get a new JWT with updated role'],
        ['Two terminals needed', 'Resource server returns 404', 'Only auth server is running', 'Project 2 requires TWO terminals: auth (port 8000) + resource (port 8001)'],
        ['Lockout not clearing', '423 after waiting 15 minutes', 'System clock timezone issue', 'Ensure server uses timezone.utc consistently - check locked_until in DB'],
      ]} />
    </Section>

    <InfoBox type="tip" title="What's still missing?">
      There's no way to <strong>revoke an access token</strong> before it expires. If a user logs out or is compromised, their access token keeps working until it naturally expires (1 hour). Project 3 solves this with JTI-based token blacklisting.
    </InfoBox>
  </>)
}

function Section({ title, children }) {
  return <section className="mt-12 mb-8"><h2 className="text-2xl font-bold mb-4 text-[var(--color-text)]">{title}</h2>{children}</section>
}

function P({ children }) {
  return <p className="text-[var(--color-text-secondary)] leading-[1.8] text-[15px] mb-5">{children}</p>
}
