import CodeBlock from '../../components/CodeBlock'
import { InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import { ShieldAlert } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter12() {
  return (<>
    <H icon={ShieldAlert} title="Security Hardening" badge="Chapter 12 · Advanced" color="red" />

    <P>Your basic authentication system works. Users can register, log in, receive tokens, and access protected data. If you stopped here, you would have a functional application - and a vulnerable one. A determined attacker does not need to break your cryptography. They just need to try "password123" ten thousand times, reuse a stolen token after the user logs out, or trick someone into clicking a phishing link. This chapter adds three armor layers that defend against these real-world attacks.</P>

    <P>Think of it like building a house. The foundation (JWT, bcrypt, RBAC) makes the house stand up. But you also need a lock on the door, a deadbolt, and a way to change the locks if someone copies your key. That is what account lockout, token blacklisting, and password reset provide - they handle the cases where something has already gone wrong.</P>

    <Section title="Account Lockout - Stopping Brute Force Attacks">
      <P>A brute force attack is the simplest, most boring, and most effective attack against passwords. The attacker does not need to be clever. They just need a script that tries thousands of passwords against a single account: "password", "password1", "password123", "letmein", "qwerty"... down a list of the most common passwords. Even with bcrypt slowing each attempt to 250 milliseconds, an attacker trying the top 10,000 passwords would finish in under an hour.</P>

      <P>The defense is equally simple: after a small number of failed attempts, lock the account temporarily. Five wrong passwords in a row? The account is frozen for 15 minutes. This transforms a brute force attack from "try 10,000 passwords in an hour" to "try 5 passwords every 15 minutes" - a rate so slow that even weak passwords become impractical to crack this way.</P>

      <P>The key design decision is making the lockout <strong>temporary</strong>, not permanent. A permanent lockout creates a denial-of-service vulnerability: an attacker could intentionally lock every account in your system by trying five wrong passwords on each one. A 15-minute temporary lockout frustrates automated attacks while allowing legitimate users to try again after a short wait.</P>

      <MermaidDiagram title="Login flow with account lockout protection" chart={`flowchart TD
    A["📨 POST /api/login<br/>{username, password}"] --> B{"🔒 Account locked?"}
    B -->|"Yes - locked_until > now"| C["❌ 423 Locked<br/>'Account locked. Try again in X minutes'"]
    B -->|"No - account is active"| D{"🔑 Password correct?"}
    D -->|"Wrong password"| E["Increment failed_attempts"]
    E --> F{"failed_attempts >= 5?"}
    F -->|"Yes"| G["🔒 Lock account for 15 min<br/>Set locked_until = now + 15min"]
    G --> H["❌ 401 Invalid credentials"]
    F -->|"No (attempt 1-4)"| H
    D -->|"Correct password"| I["✅ Reset failed_attempts to 0"]
    I --> J["✅ 200 OK + JWT tokens"]
    style C fill:#fef2f2,stroke:#dc2626
    style H fill:#fffbeb,stroke:#d97706
    style J fill:#ecfdf5,stroke:#059669
    style G fill:#fef2f2,stroke:#dc2626`} />

      <P>Notice the flow carefully. The very first check is whether the account is already locked - before we even look at the password. If the lock has expired, we reset the counter and proceed normally. If the password is correct, we reset the failed attempt counter to zero (a successful login clears the slate). If the password is wrong, we increment the counter and check if it has crossed the threshold.</P>

      <CodeBlock title="Account lockout implementation" language="python" code={`from datetime import datetime, timedelta, timezone

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

@app.post("/api/login")
def login(credentials: UserLogin):
    user = db.get_user(credentials.username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Check if account is locked
    if user.get("locked_until"):
        lock_time = datetime.fromisoformat(user["locked_until"])
        if datetime.now(timezone.utc) < lock_time:
            remaining = (lock_time - datetime.now(timezone.utc)).seconds // 60
            raise HTTPException(
                status_code=423,
                detail=f"Account locked. Try again in {remaining} minutes"
            )
        else:
            # Lock expired - reset
            db.reset_failed_attempts(credentials.username)

    # Verify password
    if not verify_password(credentials.password, user["password_hash"]):
        # Wrong password - increment counter
        attempts = db.increment_failed_attempts(credentials.username)
        if attempts >= MAX_FAILED_ATTEMPTS:
            db.lock_account(
                credentials.username,
                until=datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Success - reset failed attempts
    db.reset_failed_attempts(credentials.username)
    return {
        "access_token": create_access_token(user["username"], user["role"]),
        "refresh_token": create_refresh_token(user["username"]),
    }`} />

      <InfoBox type="warning" title="Never reveal whether the account exists">
        Notice the error message is always "Invalid credentials" - never "User not found" or "Wrong password." If you said "User not found," an attacker could test thousands of usernames to build a list of valid accounts. Always use the same generic message regardless of whether the username or password was wrong. This is called <strong>anti-enumeration</strong>.
      </InfoBox>
    </Section>

    <Section title="Token Blacklisting with JTI - Solving the Revocation Problem">
      <P>Here is a fundamental problem with JWTs: they are stateless. The server signs a token and hands it to the client. From that moment, the token is self-contained - the server does not track it, does not store it, does not even remember issuing it. It verifies the token purely by checking the cryptographic signature and the expiration date. This is what makes JWTs fast and scalable.</P>

      <P>But it also means you cannot "log out" a user in the traditional sense. When a user clicks "Logout," what do you actually do? You cannot "un-sign" the token. You cannot reach into the user's browser and delete it (well, you can clear the frontend state, but a copy could exist elsewhere). The token is still cryptographically valid until it expires. If an attacker copied it before the user logged out, they can keep using it.</P>

      <P>The solution is to maintain a <strong>blacklist</strong> of revoked token IDs. Every JWT in our system includes a <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">jti</code> (JWT ID) - a unique identifier for that specific token. When a user logs out, we add their token's JTI to a blacklist. On every subsequent request, we check the incoming token's JTI against that blacklist before granting access. The token is still cryptographically valid, but we choose to reject it anyway.</P>

      <P>This does add a small amount of server-side state - the blacklist itself. But it is minimal: you only need to store JTIs (short strings), and only for tokens that have not yet expired naturally. Once a token's expiration time passes, it is invalid regardless of the blacklist, so you can remove it.</P>

      <MermaidDiagram title="Token blacklisting - logout and revocation flow" chart={`sequenceDiagram
    participant C as 🌐 Client
    participant S as 🖥️ Server
    participant BL as 📋 Blacklist

    Note over C: User clicks "Logout"
    C->>S: POST /api/logout<br/>Authorization: Bearer eyJ...{jti: "abc123"}
    S->>S: Decode JWT, extract jti = "abc123"
    S->>BL: Add "abc123" to blacklist
    S-->>C: 200 OK - "Logged out"

    Note over C: Later - attacker tries stolen token
    C->>S: GET /api/me<br/>Authorization: Bearer eyJ...{jti: "abc123"}
    S->>S: Decode JWT - signature valid ✓
    S->>BL: Is "abc123" blacklisted?
    BL-->>S: YES - revoked!
    S-->>C: 401 Unauthorized - "Token revoked"`} />

      <CodeBlock title="JTI-based token blacklisting" language="python" code={`# In production, use Redis with TTL for automatic cleanup
token_blacklist: set = set()

def get_current_user(token: str = Depends(oauth2_scheme)):
    """Verify JWT and check blacklist."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Check if this specific token has been revoked
    jti = payload.get("jti")
    if jti in token_blacklist:
        raise HTTPException(status_code=401, detail="Token has been revoked")

    return payload

@app.post("/api/logout")
def logout(user: dict = Depends(get_current_user)):
    """Revoke the current access token by blacklisting its JTI."""
    token_blacklist.add(user["jti"])
    return {"message": "Successfully logged out"}

# The blacklist only needs to hold JTIs until the token's natural expiration.
# A token that expires in 15 min doesn't need to stay blacklisted forever.
# Redis TTL handles this automatically:
#   redis.setex(f"blacklist:{jti}", ttl=900, value="revoked")`} />

      <ComparisonTable headers={['Approach', 'How it works', 'Pros', 'Cons']} rows={[
        ['No blacklist', 'Wait for token to expire', 'Zero server state', 'Cannot revoke tokens - 15 min window of vulnerability'],
        ['In-memory set', 'Python set of revoked JTIs', 'Simple, fast lookups', 'Lost on server restart, doesn\'t scale to multiple servers'],
        ['Redis blacklist', 'Redis SET with TTL per entry', 'Shared across servers, auto-cleanup', 'Requires Redis infrastructure'],
        ['Database table', 'SQL table of revoked JTIs', 'Persistent, queryable', 'DB lookup on every request - slower'],
      ]} />
    </Section>

    <Section title="Password Reset - When Users Forget">
      <P>Users forget passwords. It is an absolute certainty in any system with more than a handful of users. You need a way for them to recover access. But here is the catch: you cannot just "email them their password." You do not have their password. Remember Chapter 6 - we store a bcrypt hash, which is a one-way transformation. There is no way to reverse it back to the original password. You could not email them their password even if you wanted to.</P>

      <P>Instead, you let them <strong>set a new password</strong>. The secure way to do this is a three-step process: the user requests a reset, the server sends a secret one-time link to their email, and the user clicks that link and enters a new password. The email step is critical - it proves the user controls the email address on file, which serves as a second factor of identity verification.</P>

      <P>The reset token itself is not a JWT. It is a cryptographically random string generated by <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">secrets.token_urlsafe(32)</code> - 32 bytes of randomness that is impossible to guess. It expires after one hour and can only be used once. This limits the window of vulnerability if the email is intercepted.</P>

      <MermaidDiagram title="Password reset - request, verify, and update" chart={`sequenceDiagram
    participant U as 👤 User
    participant S as 🖥️ Server
    participant E as 📧 Email Service
    participant DB as 🗄️ Database

    U->>S: POST /api/forgot-password<br/>{"email": "alice@example.com"}
    S->>DB: Find user by email
    DB-->>S: User found (or not)
    Note over S: Generate random token<br/>Store: {token → username, expires}
    S->>E: Send reset link to alice@example.com
    S-->>U: "If that email exists, a reset link has been sent"
    Note over S: Same response whether<br/>email exists or not!

    Note over U: User clicks link in email
    U->>S: POST /api/reset-password<br/>{"token": "a8f2k9...", "new_password": "NewP@ss456"}
    S->>S: Look up token - valid and not expired?
    S->>DB: Update password_hash = bcrypt("NewP@ss456")
    S->>S: Delete the reset token (single-use)
    S-->>U: "Password updated successfully"`} />

      <CodeBlock title="Password reset - request and confirmation" language="python" code={`import secrets

# Store reset tokens: {token: {username, expires_at}}
reset_tokens: dict = {}

@app.post("/api/forgot-password")
def forgot_password(body: ForgotPasswordRequest):
    """Request a password reset. ALWAYS returns success -
    never reveal whether the email exists (anti-enumeration)."""
    user = db.get_user_by_email(body.email)

    if user:
        # Generate a cryptographically random reset token
        token = secrets.token_urlsafe(32)
        reset_tokens[token] = {
            "username": user["username"],
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        }
        # In production: send email with reset link
        # send_email(body.email, f"Reset link: /reset?token={token}")

    # ALWAYS return the same response - even if email doesn't exist
    return {"message": "If that email exists, a reset link has been sent"}

@app.post("/api/reset-password")
def reset_password(body: ResetPasswordRequest):
    """Complete password reset using the token from email."""
    token_data = reset_tokens.get(body.token)

    if not token_data:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if datetime.now(timezone.utc) > token_data["expires_at"]:
        del reset_tokens[body.token]
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # Update the password
    new_hash = hash_password(body.new_password)
    db.update_password(token_data["username"], new_hash)

    # Invalidate the reset token (single use)
    del reset_tokens[body.token]

    # Optionally: revoke all existing JWTs for this user
    return {"message": "Password updated successfully"}`} />

      <P>Two anti-enumeration details deserve attention. First, the <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">/forgot-password</code> endpoint always returns the same message - "If that email exists, a reset link has been sent" - regardless of whether the email is in the database. If it said "Email not found," an attacker could test thousands of email addresses to discover which ones have accounts. Second, both the "token not found" and "token expired" cases return the same error message: "Invalid or expired token." This prevents attackers from distinguishing between a wrong token and a real but expired one.</P>

      <InfoBox type="tip" title="After a password reset, revoke all existing tokens">
        When a user resets their password, it usually means they suspect their account is compromised. Best practice is to revoke all existing access and refresh tokens for that user at the same time. This forces every session - including any attacker's session - to re-authenticate with the new password.
      </InfoBox>
    </Section>
  </>)
}
