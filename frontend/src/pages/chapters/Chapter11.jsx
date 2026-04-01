import CodeBlock from '../../components/CodeBlock'
import { InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import { RefreshCw } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter11() {
  return (<>
    <H icon={RefreshCw} title="Refresh Tokens & Rotation" badge="Chapter 11 · Intermediate" color="orange" />

    <P>Imagine your office keycard expires every hour. Every single hour, you have to leave your desk, walk to the front desk, show your government-issued ID, wait for a new keycard, and walk back. You would get nothing done. Now imagine the building gave you a special second card — a "renewal card" — that lets you walk up to the front desk and get a new keycard instantly, without showing your ID again. You can only use this renewal card at the front desk, not at any door. And every time you use it, the old renewal card is destroyed and you get a fresh one.</P>

    <P>That is exactly how refresh tokens work. The access token is your keycard — it opens doors (API endpoints) but expires quickly. The refresh token is your renewal card — it cannot open any doors, but it can get you a new keycard without making you log in again. This chapter explains why this two-token system exists, how it works mechanically, and why the "destroy and replace" step (rotation) is critical for security.</P>

    <Section title="The Problem: Security and Convenience Are at War">
      <P>Access tokens must be short-lived. If an attacker steals one — through a cross-site scripting vulnerability, a compromised network, or a leaked log file — the damage is limited to however long the token is valid. A 15-minute token means 15 minutes of unauthorized access, not 15 days. This is why our projects set access token expiration to 15-30 minutes.</P>

      <P>But short-lived tokens create a terrible user experience. Imagine writing a long document in a web application and getting kicked to the login screen every 15 minutes because your token expired. You would abandon the application. Users expect to log in once and stay logged in for days or weeks.</P>

      <P>You cannot satisfy both requirements with a single token. A short lifetime is secure but annoying. A long lifetime is convenient but dangerous. Refresh tokens break this deadlock by splitting the problem in two: a short-lived token for daily use, and a longer-lived token whose only job is renewal.</P>
    </Section>

    <Section title="Access Token vs Refresh Token — Two Different Jobs">
      <ComparisonTable headers={['Property', 'Access Token', 'Refresh Token']} rows={[
        ['Purpose', 'Authorize API requests', 'Obtain new access tokens'],
        ['Lifetime', '15 minutes', '7 days'],
        ['Sent to', 'Every protected endpoint', 'Only /api/refresh'],
        ['Contains', 'sub, role, exp, jti, type: "access"', 'sub, exp, jti, type: "refresh"'],
        ['If stolen', 'Attacker gets 15 min of access', 'Attacker can mint new access tokens'],
        ['Revocable?', 'Not easily (stateless)', 'Yes — stored/tracked server-side'],
        ['Stored by client', 'JavaScript variable (memory)', 'HttpOnly cookie or secure storage'],
      ]} />

      <P>Notice the asymmetry in this design. Access tokens are optimized for <strong>speed</strong> — they are short-lived and stateless, meaning the server never has to look anything up in a database to verify one. It just checks the signature and the expiration. Refresh tokens are optimized for <strong>security</strong> — they live longer but are tracked server-side, sent to only one endpoint, and can be revoked instantly. Each token type is designed for a different threat model.</P>

      <P>The refresh token also contains a <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">type: "refresh"</code> field in its JWT payload. This prevents a subtle attack: without the type field, someone could use an access token on the refresh endpoint (or vice versa). The server checks the type and rejects mismatched tokens immediately.</P>

      <P>Where you store these two tokens matters as well. The access token lives in a JavaScript variable — in memory, not in localStorage or sessionStorage. This means it disappears when the user closes the tab, which limits exposure. The refresh token, because it needs to survive longer, is ideally stored in an HttpOnly cookie that JavaScript cannot read, making it invisible to cross-site scripting attacks. In our projects, both are handled in memory for simplicity, but the principle holds: minimize the surface area where each token can be accessed.</P>
    </Section>

    <Section title="The Refresh Flow — Step by Step">
      <P>Here is what happens when the access token expires and the frontend needs a new one. The entire process is invisible to the user — it happens in the background, typically triggered by the frontend receiving a 401 response.</P>

      <MermaidDiagram title="Token refresh with rotation — old tokens are revoked" chart={`sequenceDiagram
    participant C as 🌐 Client
    participant S as 🖥️ Server
    participant DB as 🗄️ Database

    Note over C: Access token expired (15 min)

    C->>S: POST /api/refresh<br/>{"refresh_token": "eyR...old"}
    S->>S: Verify refresh JWT signature ✓
    S->>S: Check type == "refresh" ✓
    S->>DB: Is JTI "abc123" blacklisted?
    DB-->>S: No — token is valid

    Note over S: ROTATION: revoke old, issue new
    S->>DB: Blacklist old JTI "abc123"
    Note over S: Create new access token (jti: "def456")<br/>Create new refresh token (jti: "ghi789")
    S-->>C: 200 OK<br/>{"access_token": "eyN...new",<br/>"refresh_token": "eyM...new"}

    Note over C: Discard old tokens,<br/>store new ones

    Note over C,DB: STOLEN TOKEN DETECTION
    C->>S: POST /api/refresh<br/>{"refresh_token": "eyR...old"}
    S->>DB: Is JTI "abc123" blacklisted?
    DB-->>S: YES — already used!
    Note over S: ⚠️ Someone reused a revoked token!<br/>This means it was stolen.
    S-->>C: 401 Unauthorized<br/>"Token has been revoked"`} />

      <P>The flow has five distinct steps. First, the server verifies the refresh token's cryptographic signature — is this a real token signed by our secret key, or a forgery? Second, it checks the <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">type</code> field to make sure this is actually a refresh token and not an access token being misused. Third, it looks up the token's unique ID (JTI) in the blacklist to see if this token has already been used. Fourth — and this is the rotation step — it adds the old token's JTI to the blacklist so it can never be used again. Fifth, it creates a completely new pair of tokens and sends them back.</P>

      <P>The result: the user gets fresh tokens without re-entering their password, and the old tokens are dead. Every refresh is a clean handoff.</P>
    </Section>

    <Section title="Why Rotation Matters — A Stolen Token Scenario">
      <P>To understand why rotation is essential, imagine what happens without it. Suppose an attacker steals a refresh token that expires in 7 days. Without rotation, that token stays valid for the full 7 days. The attacker can use it over and over to mint new access tokens, and the legitimate user has no idea anything is wrong. Both the attacker and the user are refreshing with the same token, and both succeed.</P>

      <P>Now imagine the same scenario with rotation. The attacker steals the refresh token. But the next time the legitimate user's access token expires, their frontend sends the refresh token to the server. The server accepts it, blacklists it, and issues a new pair. Now the attacker tries to use the stolen token — and it has been blacklisted. The server rejects it immediately.</P>

      <P>Here is the clever part: the detection works in reverse too. If the attacker uses the stolen token <em>first</em>, they get new tokens. But then the legitimate user tries to refresh with their copy of the same token, and it fails because the attacker already caused it to be blacklisted. This failure is a <strong>detection signal</strong>. A token that should have been single-use was attempted twice, which means it was compromised. At that point, a well-designed system revokes all tokens for that user and forces a complete re-login.</P>

      <InfoBox type="warning" title="The race condition is a feature, not a bug">
        Whether the attacker or the legitimate user refreshes first, the other one fails. That failure is what turns a silent theft into a detectable event. Without rotation, stolen tokens are invisible. With rotation, every theft eventually surfaces as a blacklist violation.
      </InfoBox>
    </Section>

    <Section title="The Refresh Endpoint — Our Implementation">
      <P>Here is the actual code from our project. Each step maps directly to the flow described above.</P>

      <CodeBlock title="main.py — Token refresh with rotation" language="python" code={`# In-memory blacklist (use Redis in production)
token_blacklist: set = set()

@app.post("/api/refresh")
def refresh_token(body: RefreshRequest):
    """Issue new token pair, revoking the old refresh token.

    Flow:
    1. Verify the refresh token's signature and expiration
    2. Confirm it hasn't been blacklisted (single-use check)
    3. Blacklist the old refresh token's JTI
    4. Issue a brand-new access + refresh token pair
    """
    # Step 1: Verify the refresh token
    try:
        payload = jwt.decode(
            body.refresh_token, SECRET_KEY, algorithms=["HS256"]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Step 2: Check token type
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")

    # Step 3: Check if this token has already been used (rotation check)
    jti = payload.get("jti")
    if jti in token_blacklist:
        # ALERT: token reuse detected — possible theft!
        # In production: revoke ALL tokens for this user
        raise HTTPException(
            status_code=401,
            detail="Token has been revoked (possible compromise)"
        )

    # Step 4: Blacklist the old refresh token (single-use)
    token_blacklist.add(jti)

    # Step 5: Issue new token pair
    username = payload["sub"]
    user = db.get_user(username)

    return {
        "access_token": create_access_token(username, user["role"]),
        "refresh_token": create_refresh_token(username),
        "token_type": "bearer",
    }`} />

      <P>The critical line is <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">token_blacklist.add(jti)</code>. This is what makes each refresh token single-use. Once that JTI is in the set, any subsequent attempt to use the same token — whether by an attacker or by accident — hits the blacklist check and is rejected with a 401. The token is spent.</P>

      <P>Notice that the blacklist check happens <em>before</em> the blacklist write. The order matters: check first, then blacklist, then issue new tokens. If you blacklisted first and then checked, you would always reject the token because you just added it.</P>

      <InfoBox type="tip" title="Production consideration">
        Our projects use an in-memory Python set for the blacklist. This works for learning but has two limitations: it resets when the server restarts, and it does not share across multiple server instances. In production, you would use Redis with a TTL (time-to-live) matching the token's remaining lifetime. Once the token would have expired naturally, Redis automatically removes it from the blacklist — no cleanup needed.
      </InfoBox>
    </Section>
  </>)
}
