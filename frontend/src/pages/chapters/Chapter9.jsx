import CodeBlock from '../../components/CodeBlock'
import { FlowStep, InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import { KeyRound } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter9() {
  return (<>
    <H icon={KeyRound} title="RS256 Asymmetric JWT" badge="Chapter 9 · Intermediate" color="orange" />

    <P>Picture this nightmare scenario. You've built a microservices architecture: an auth server that issues JWTs, and three resource servers — an API, a file service, and an analytics dashboard — that verify them. You're using HS256, which means every server shares the same SECRET_KEY (because the key that verifies tokens is the same key that creates them). One night, your analytics dashboard gets hacked. It was running an outdated dependency, and an attacker exploited it to dump the server's environment variables. They now have your SECRET_KEY.</P>

    <P>Game over. Not just for the analytics server — for your <strong>entire system</strong>. The attacker can now forge JWTs for any user, with any role, with any expiration. They can create a token that says <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">{`{"sub": "admin", "role": "super_admin"}`}</code> and every server in your infrastructure will trust it. A single compromised service has brought down your entire security model.</P>

    <P>Now replay the same scenario with RS256. The analytics server is compromised. The attacker dumps its environment. But all they find is the <strong>public key</strong>. The public key can verify tokens — but it cannot create them. The attacker can read existing tokens, but they cannot forge new ones. The private key, the only thing that can sign tokens, has never left the auth server. Your auth system is still intact. You rotate the analytics server, patch the vulnerability, and move on. No catastrophic breach, no emergency password reset for every user.</P>

    <P>This is why RS256 exists. It separates the ability to <strong>create</strong> tokens from the ability to <strong>verify</strong> them, so that compromising a consumer doesn't compromise the producer.</P>

    <Section title="Public-Key Cryptography: The Padlock Analogy">
      <P>To understand RS256, you need to understand public-key cryptography, and the easiest way is with a physical analogy. Imagine you have a special padlock with two keys: a <strong>private key</strong> that only you possess, and a <strong>public key</strong> that you've given copies of to everyone in the world.</P>

      <P>Here's the twist: these keys work in opposite directions. If you lock something with the private key, anyone with the public key can unlock it — but nobody else can lock it the same way. If someone hands you a box locked with your private key's unique mechanism, they can verify it came from you, because you're the only person in the world who has that key.</P>

      <P>In JWT terms: the auth server "locks" (signs) each token with the private key. Any resource server with the public key can "unlock" (verify) the signature and confirm it's genuine. But no resource server can create a new signed token, because they don't have the private key. The private key is the notary's stamp. The public key is the reference guide that tells you what a genuine stamp looks like.</P>

      <P>This is fundamentally different from HS256, where the same key both signs and verifies. With HS256, giving someone the ability to verify tokens also gives them the ability to forge them. With RS256, verification and signing are completely decoupled.</P>
    </Section>

    <Section title="HS256 vs RS256 — The Core Difference">
      <ComparisonTable headers={['Property', 'HS256 (Symmetric)', 'RS256 (Asymmetric)']} rows={[
        ['Keys', 'One shared secret key', 'Key pair: private + public'],
        ['Signing', 'SECRET_KEY signs the token', 'Private key signs the token'],
        ['Verification', 'Same SECRET_KEY verifies', 'Public key verifies (different key!)'],
        ['If verifier is hacked', 'Attacker can FORGE tokens', 'Attacker can only VERIFY — cannot forge'],
        ['Key distribution', 'Must be kept secret everywhere', 'Public key can be shared openly'],
        ['Used in', 'Project 1 (single server)', 'Project 2 (auth + resource servers)'],
        ['Performance', 'Faster (HMAC is lightweight)', 'Slower (RSA math is heavy)'],
        ['Best for', 'Single-server apps', 'Microservices, third-party verification'],
      ]} />

      <P>So when should you use which? If your entire application is a single server — one FastAPI process that both issues and verifies tokens — HS256 is simpler and faster. There's no key distribution problem because the key never leaves the one server. But the moment you have multiple services that need to verify tokens, or you want third parties to be able to verify your tokens without trusting them with the signing key, RS256 is the right choice. This is why Project 1 uses HS256 and Project 2 switches to RS256.</P>
    </Section>

    <Section title="How It Works — Two Servers, Two Keys">
      <P>Let's see the flow in action. The auth server is the only system that holds the private key. When a user logs in, the auth server signs the JWT with the private key. The user then takes that token to any resource server, which verifies it using the public key. At no point does the private key leave the auth server.</P>

      <MermaidDiagram title="Auth server signs with private key; resource server verifies with public key" chart={`sequenceDiagram
    participant U as 👤 User
    participant AS as 🔐 Auth Server<br/>(has PRIVATE key)
    participant RS as 📡 Resource Server<br/>(has PUBLIC key only)

    Note over AS: Private key NEVER leaves<br/>the auth server

    U->>AS: POST /api/login<br/>{"username": "alice", "password": "secret"}
    Note over AS: Verify credentials ✓<br/>Sign JWT with PRIVATE key
    AS-->>U: {"access_token": "eyJ...RS256..."}

    U->>RS: GET /api/data<br/>Authorization: Bearer eyJ...RS256...
    Note over RS: Verify signature with PUBLIC key ✓<br/>Extract claims: {sub: "alice", role: "admin"}
    RS-->>U: 200 OK {"data": "..."}

    Note over RS: Even if this server is hacked,<br/>attacker CANNOT forge new tokens —<br/>they only have the public key`} />

      <P>This architecture means you can add new resource servers at any time without increasing your security risk. Each new server gets a copy of the public key — a file you could post on a billboard and it wouldn't matter. The private key sits on one server, behind multiple layers of protection, and never moves.</P>
    </Section>

    <Section title="Generating RSA Key Pairs">
      <P>Before we can sign anything, we need to generate the key pair. This is a one-time setup step. The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">cryptography</code> library generates a mathematically linked pair: a private key (which you guard with your life) and a public key (which is derived from the private key but cannot be used to reconstruct it).</P>

      <P>The key size of 2048 bits determines how hard it is to crack. A 2048-bit RSA key would take a classical computer longer than the age of the universe to factor. We save both keys as PEM files — a standard text format that starts with <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">-----BEGIN PRIVATE KEY-----</code> and can be read by virtually every cryptographic library.</P>

      <CodeBlock title="keys.py — Generate RSA key pair for RS256" language="python" code={`from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization
import os

def generate_keys():
    """Generate an RSA key pair for RS256 JWT signing.

    - Private key: stays on the auth server ONLY
    - Public key: distributed to all resource servers
    """
    # Generate a 2048-bit RSA private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,  # Standard RSA exponent
        key_size=2048,          # 2048 bits = good until ~2030
    )

    # Save private key (auth server only!)
    with open("private_key.pem", "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    # Save public key (safe to distribute)
    public_key = private_key.public_key()
    with open("public_key.pem", "wb") as f:
        f.write(public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ))

    print("✓ Keys generated: private_key.pem, public_key.pem")

if __name__ == "__main__":
    generate_keys()`} />

      <P>After running this script, you'll have two files. The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">private_key.pem</code> file stays on the auth server and goes into <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">.gitignore</code> immediately. The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">public_key.pem</code> file can be copied to every resource server, committed to your repo, emailed to a colleague, or published on your website. It doesn't matter who sees it — the public key can only verify, never sign.</P>

      <InfoBox type="warning" title="Never commit private keys">
        Add <code className="text-xs font-mono">private_key.pem</code> to your <code className="text-xs font-mono">.gitignore</code> immediately. The public key is safe to commit — that's the whole point. But the private key must never leave the auth server. If you accidentally commit it, treat it like a leaked password: generate a new key pair and rotate immediately.
      </InfoBox>
    </Section>

    <Section title="Signing and Verifying with RS256">
      <P>The code for RS256 looks almost identical to HS256 — the PyJWT library abstracts away the RSA math. The only differences are the algorithm name (<code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">"RS256"</code> instead of <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">"HS256"</code>) and the fact that signing uses the private key while verification uses the public key. This is where the separation of concerns lives in the code.</P>

      <CodeBlock title="auth.py — RS256 token creation and verification" language="python" code={`import jwt

# Auth server loads the PRIVATE key (for signing)
with open("private_key.pem", "r") as f:
    PRIVATE_KEY = f.read()

# Resource servers load the PUBLIC key (for verifying)
with open("public_key.pem", "r") as f:
    PUBLIC_KEY = f.read()

def create_token_rs256(username: str, role: str) -> str:
    """Sign a JWT with the RSA private key."""
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }
    # Note: algorithm is "RS256", key is the PRIVATE key
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")

def verify_token_rs256(token: str) -> dict:
    """Verify a JWT with the RSA public key.

    This function can run on ANY server that has the public key.
    It does NOT need the private key.
    """
    return jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])`} />

      <P>Look at those two functions carefully. <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">create_token_rs256</code> uses <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">PRIVATE_KEY</code>. <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">verify_token_rs256</code> uses <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">PUBLIC_KEY</code>. In a real deployment, these two functions would live on different servers. The auth server has both keys (because the public key is derived from the private key). The resource server only has the public key and only runs <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">verify_token_rs256</code>. It physically cannot call <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">create_token_rs256</code> because the private key doesn't exist on that machine.</P>
    </Section>

    <Section title="The Public Key Endpoint — And Why It's Safe">
      <P>In a microservices architecture, resource servers need to get the public key from somewhere. The simplest and most common approach: the auth server exposes it as an API endpoint. This might feel wrong at first — "we're just handing out our key over HTTP?" — but remember, the public key is <em>designed</em> to be public. That's literally its name and its purpose. Knowing the public key lets you verify tokens. It does not let you create them.</P>

      <P>Think of it like a company's official letterhead. The company publishes what their letterhead looks like so you can verify authentic letters. Knowing what the letterhead looks like doesn't help you print new letters — you'd need access to their printing press (the private key) for that.</P>

      <CodeBlock title="Public key endpoint on the auth server" language="python" code={`@app.get("/api/public-key")
def get_public_key():
    """Serve the public key for resource servers to verify JWTs.

    This endpoint requires NO authentication — the public key
    is meant to be public. That's the entire point of asymmetric crypto.
    """
    with open("public_key.pem", "r") as f:
        return {"public_key": f.read()}

# On the resource server (at startup):
import requests

response = requests.get("http://auth-server:8000/api/public-key")
PUBLIC_KEY = response.json()["public_key"]
# Now use PUBLIC_KEY to verify all incoming JWTs`} />

      <P>The resource server fetches the public key once at startup and caches it in memory. From that point on, it can verify every incoming JWT without ever contacting the auth server again. This is an important architectural benefit — the resource server is fully independent. Even if the auth server goes down temporarily, the resource server can still verify tokens it already knows how to check. Users who already have valid tokens experience no interruption.</P>

      <InfoBox type="tip" title="This pattern is everywhere">
        RS256 with public key distribution is how Google, Auth0, Okta, and every major identity provider works. They publish their public keys at a well-known URL (called a JWKS endpoint — JSON Web Key Set). Any service in the world can verify tokens from these providers without ever touching the signing key. You're learning the same pattern used at massive scale.
      </InfoBox>
    </Section>
  </>)
}
