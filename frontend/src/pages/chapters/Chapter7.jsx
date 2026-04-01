import CodeBlock from '../../components/CodeBlock'
import { InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import JWTDecoder from '../../components/JWTDecoder'
import { Key } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter7() {
  return (<>
    <H icon={Key} title="JWT Deep Dive" badge="Chapter 7 · Core" color="primary" />

    <P>You're at a club on a Saturday night. The line stretches around the block. You wait, reach the bouncer, and hand over your ID. He checks your photo, checks your date of birth, nods, and stamps your hand with invisible ink that glows under UV light. For the rest of the night, you never pull out your ID again. You walk up to the bar and flash your hand. You head to the VIP lounge and flash your hand. The stamp is enough, because every staff member in the building knows: that stamp can only come from the bouncer at the front door, and it's impossible to fake.</P>

    <P>Now imagine the stamp was even cleverer. It didn't just prove "this person was let in" - it actually contained information. Your name, your age, your VIP tier, and what time the stamp expires (because at 2 AM, everyone has to re-verify). That's a JWT. It's a hand stamp that carries data inside it, and it's been cryptographically signed so nobody can alter that data without being caught.</P>

    <P>A JWT (JSON Web Token, pronounced "jot") is the most common way modern web applications handle authentication after login. The key word is <strong>self-contained</strong>. Unlike a session ID, which is just a random string that forces the server to look up who you are in a database on every single request, a JWT carries your identity inside the token itself. The server can read your username, your role, and your token's expiration directly from the token - no database lookup required. For a system handling thousands of requests per second, that difference is enormous.</P>

    <P>But this self-contained nature comes with a critical trade-off that trips up almost every beginner. Let's crack open a JWT, look at its guts, and understand both the power and the danger.</P>

    <Section title="Try It - Decode a JWT">
      <P>Before we explain the theory, try it yourself. Paste any JWT token below to see its decoded contents. The sample token shows the structure from our projects. As you look at the decoded output, notice something important: <strong>the payload is completely readable</strong>. You don't need a secret key to read what's inside a JWT. The signature only prevents tampering - it doesn't prevent reading. We'll come back to why that matters.</P>
      <JWTDecoder className="my-6" />
    </Section>

    <Section title="The Three Parts of a JWT">
      <P>Every JWT is made of three pieces, separated by dots. If you look at a raw token, it's just one long string like <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">eyJhbGciOi...eyJzdWIiOi...SflKxwRJSM...</code>. Those three chunks are the <strong>header</strong>, the <strong>payload</strong>, and the <strong>signature</strong>. Each one is a Base64-encoded JSON object (or, for the signature, Base64-encoded bytes).</P>

      <P>Think of it like a three-part sealed envelope. The header says "this envelope was sealed using method X." The payload is the actual letter inside. The signature is the wax seal - it proves the letter hasn't been opened and rewritten since the original sender sealed it.</P>

      <CodeBlock title="A real JWT - decoded" language="json" code={`// The raw token (one long string, three parts separated by dots):
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
// eyJzdWIiOiJhbGljZSIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTcxMjM0NTY3OCwiaWF0IjoxNzEyMzQyMDc4LCJqdGkiOiJhYmMxMjMifQ.
// SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

// PART 1 - Header (algorithm + type)
{
  "alg": "HS256",    // Signing algorithm (HMAC-SHA256)
  "typ": "JWT"       // Token type
}

// PART 2 - Payload (your data / "claims")
{
  "sub": "alice",        // Subject - who this token is for
  "role": "admin",       // Custom claim - user's role
  "exp": 1712345678,     // Expires at (Unix timestamp)
  "iat": 1712342078,     // Issued at
  "jti": "abc123"        // Unique token ID (for blacklisting)
}

// PART 3 - Signature
// HMAC-SHA256(
//   base64(header) + "." + base64(payload),
//   SECRET_KEY
// )
// → This is what makes the token unforgeable`} />

      <P>The header tells the server which algorithm was used to create the signature, so it knows how to verify it. The payload carries the actual data about the user - these key-value pairs are called "claims." And the signature is the mathematical proof that this exact header and this exact payload were stamped by a server that knows the SECRET_KEY. If an attacker changes even one character in the header or payload - say, changing <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">"role": "user"</code> to <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">"role": "admin"</code> - the signature won't match and the server will reject the token immediately.</P>
    </Section>

    <Section title="Signed Does Not Mean Secret">
      <P>This is the single most dangerous misconception about JWTs, and it has caused real security breaches. Base64 is <strong>encoding</strong>, not <strong>encryption</strong>. Encoding is just a way to represent data in a different format - like translating English to Morse code. Anyone who intercepts the token can decode the payload in milliseconds. Go ahead, copy any JWT and paste it into jwt.io. You'll see everything inside it.</P>

      <P>Here's a concrete example of what goes wrong. Imagine a developer creates a JWT with this payload: <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">{`{"sub": "alice", "password": "MyS3cret!", "role": "admin"}`}</code>. They think "it's signed, so it's safe." But signing only prevents modification. Any network observer, any browser extension, any proxy server between the user and your server can read that password by simply Base64-decoding the middle part of the token. The signature proves the token is genuine - it does nothing to hide the contents.</P>

      <InfoBox type="warning" title="Treat JWT payloads like postcards">
        A postcard can be read by every postal worker who handles it. But if you sign the back, the recipient knows it came from you and nobody altered it. That's a JWT. The signature proves authenticity and integrity - not confidentiality. <strong>Never put passwords, credit card numbers, social security numbers, or any sensitive data in a JWT payload.</strong> Stick to identifiers (username, role, token ID) that are useless on their own.
      </InfoBox>
    </Section>

    <Section title="Standard Claims">
      <P>The JWT specification defines a set of registered claims - standard field names with agreed-upon meanings. You can add any custom claims you want (like "role"), but the standard ones give you interoperability with libraries and tools that know how to interpret them. Our projects use all of these:</P>

      <ComparisonTable headers={['Claim', 'Full Name', 'Purpose', 'Example Value']} rows={[
        ['sub', 'Subject', 'Who the token identifies (username)', '"alice"'],
        ['exp', 'Expiration', 'When the token becomes invalid', '1712345678 (Unix timestamp)'],
        ['iat', 'Issued At', 'When the token was created', '1712342078'],
        ['jti', 'JWT ID', 'Unique ID for this specific token', '"a1b2c3" (for blacklisting)'],
        ['role', 'Role (custom)', 'User\'s permission level', '"admin" / "user" / "guest"'],
      ]} />

      <P>The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">exp</code> claim is especially important. Without it, a token would be valid forever - if an attacker steals it, they have permanent access. By setting expiration to 15 minutes, we limit the blast radius. The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">jti</code> (JWT ID) is our escape hatch: if a user logs out, we add their token's jti to a blacklist so it's rejected even before it expires.</P>
    </Section>

    <Section title="The Full Authentication Flow">
      <P>Now that you understand what's inside a JWT, let's see how it fits into the complete lifecycle. A user registers, logs in, uses their token to access data, and refreshes it when it's about to expire. Pay attention to the moment the JWT is created - that's when the server "stamps the hand" - and every subsequent request where the server just checks the stamp without touching the database.</P>

      <MermaidDiagram title="Complete JWT authentication lifecycle" chart={`sequenceDiagram
    participant U as 👤 User
    participant S as 🖥️ Auth Server
    participant DB as 🗄️ Database

    Note over U,DB: REGISTRATION
    U->>S: POST /api/register<br/>{"username": "alice", "password": "secret"}
    S->>DB: Store username + bcrypt hash
    S-->>U: 201 Created {"id": 1, "username": "alice"}

    Note over U,DB: LOGIN
    U->>S: POST /api/login<br/>{"username": "alice", "password": "secret"}
    S->>DB: Fetch stored hash for "alice"
    Note over S: bcrypt.checkpw() ✓
    Note over S: Create JWT with {sub: "alice",<br/>role: "admin", exp: +15min}
    S-->>U: 200 OK {"access_token": "eyJ...", "refresh_token": "eyR..."}

    Note over U,DB: USE TOKEN
    U->>S: GET /api/me<br/>Authorization: Bearer eyJ...
    Note over S: Verify signature ✓<br/>Check exp > now ✓<br/>Extract sub: "alice"
    S-->>U: 200 OK {"username": "alice", "role": "admin"}

    Note over U,DB: TOKEN EXPIRES - REFRESH
    U->>S: POST /api/refresh<br/>{"refresh_token": "eyR..."}
    Note over S: Verify refresh token ✓<br/>Revoke old, issue new pair
    S-->>U: 200 OK {"access_token": "eyN...", "refresh_token": "eyM..."}`} />

      <P>Notice what happens during the "USE TOKEN" phase: the server never touches the database. It verifies the signature using the SECRET_KEY it already has in memory, checks the expiration timestamp, and extracts the username and role - all from the token itself. This is the power of self-contained tokens. For a high-traffic application, eliminating a database round-trip on every request is a massive performance win.</P>
    </Section>

    <Section title="Access Tokens vs Refresh Tokens">
      <P>We don't use one token - we use two, and they serve fundamentally different purposes. The access token is like a day pass at a theme park: it gets you on the rides, but it expires at closing time. The refresh token is like your annual membership card: it doesn't get you on rides directly, but you can show it at the ticket booth to get a new day pass tomorrow without buying another membership.</P>

      <P>Why not just make the access token last a long time? Because if it's stolen, the attacker has access for the entire duration. A 15-minute access token means a stolen token gives the attacker 15 minutes at most. But we don't want the user to re-enter their password every 15 minutes. The refresh token bridges that gap - it silently requests a new access token in the background, and the user never notices.</P>

      <ComparisonTable headers={['Property', 'Access Token', 'Refresh Token']} rows={[
        ['Purpose', 'Authorize API requests', 'Get new access tokens'],
        ['Lifetime', 'Short - 15 minutes', 'Long - 7 days'],
        ['Sent with', 'Every API request (Authorization header)', 'Only to /api/refresh endpoint'],
        ['Contains', 'sub, role, exp, iat, jti', 'sub, exp, iat, jti, type: "refresh"'],
        ['If stolen', 'Attacker has 15 min of access', 'Attacker can generate new tokens'],
        ['Storage', 'Memory (JavaScript variable)', 'HttpOnly cookie or secure storage'],
      ]} />

      <InfoBox type="tip" title="Why two tokens?">
        Short-lived access tokens limit the damage if stolen - the attacker only has minutes. But forcing users to re-login every 15 minutes is terrible UX. The refresh token solves this: it silently gets a new access token before the old one expires. The user never notices.
      </InfoBox>
    </Section>

    <Section title="The Code - Creating and Verifying JWTs">
      <P>Here's the actual code from our projects. The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">create_access_token</code> function builds the payload dictionary with all the claims we discussed, then calls <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">jwt.encode()</code> to produce the signed token string. The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">verify_token</code> function does the reverse: it takes a token string, checks the signature, checks expiration, and returns the payload dictionary if everything is valid.</P>

      <CodeBlock title="auth.py - JWT creation and verification with PyJWT" language="python" code={`import jwt
import uuid
from datetime import datetime, timedelta, timezone

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_access_token(username: str, role: str) -> str:
    """Create a short-lived access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,              # Who this token is for
        "role": role,                 # What they can do
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": now,                   # When it was issued
        "jti": str(uuid.uuid4()),     # Unique ID for blacklisting
        "type": "access",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(username: str) -> str:
    """Create a long-lived refresh token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "iat": now,
        "jti": str(uuid.uuid4()),
        "type": "refresh",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str, expected_type: str = "access") -> dict:
    """Verify a JWT and return its payload.

    Raises jwt.InvalidTokenError if:
    - Signature doesn't match (tampered or wrong key)
    - Token has expired (exp < now)
    - Token type doesn't match expected
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Wrong token type")

    return payload  # {"sub": "alice", "role": "admin", "exp": ..., ...}`} />

      <P>Notice that <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">jwt.decode()</code> does three things in one call: it decodes the Base64, verifies the signature against SECRET_KEY, and checks that <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">exp</code> hasn't passed. If any of those checks fail, it raises an exception. You don't need to manually check expiration - PyJWT does it for you. We also check the token <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">type</code> field ourselves, because PyJWT doesn't know about our custom "access" vs "refresh" distinction - that's our application logic.</P>
    </Section>
  </>)
}
