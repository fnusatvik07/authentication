import CodeBlock from '../../components/CodeBlock'
import { FlowStep, InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import { Settings } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter8() {
  return (<>
    <H icon={Settings} title="Middleware & Auth Guards" badge="Chapter 8 · Core" color="primary" />

    <P>Think about the last time you flew. Before you reached your seat on the airplane, you passed through a gauntlet of checkpoints, each one looking for something different. First, the airline counter checked your passport - are you who you claim to be? Then, airport security scanned your bags - are you carrying anything dangerous? Finally, at the gate, an agent checked your boarding pass - are you allowed on this specific flight? Each checkpoint has a single job. Each one can stop you cold. And they run in a fixed order: there's no point checking your boarding pass if you're carrying a prohibited item, and no point scanning bags if you can't prove your identity.</P>

    <P>This is exactly how middleware and auth guards work in a web application. Every HTTP request that arrives at your server passes through a series of checkpoints before it reaches the code that actually does something. Some checkpoints apply to everyone (like CORS headers - the equivalent of "everyone goes through the metal detector"). Others apply only to specific endpoints (like "only admins can access the user management panel" - the equivalent of "only first-class passengers enter the lounge"). If any checkpoint rejects the request, the pipeline stops immediately and an error goes back to the client. Your endpoint code never even runs.</P>

    <P>This architecture is powerful because it separates concerns. Your endpoint code doesn't need to worry about whether the user is authenticated or whether they have the right role - by the time the request reaches your endpoint function, all of that has already been verified. The endpoint just does its job: return data, create a resource, whatever the business logic requires.</P>

    <Section title="What Is Middleware, Exactly?">
      <P>Middleware is code that sits <strong>between</strong> the incoming request and your endpoint. The name says it all - it's in the middle. When a request arrives, it passes through each middleware layer in order. Each layer can inspect the request, modify it, reject it, or pass it along to the next layer. When the response comes back, it travels through the same layers in reverse, giving each one a chance to modify the response too.</P>

      <P>In FastAPI, there are two flavors of this pattern. <strong>Global middleware</strong> runs on every single request - you register it once, and it applies everywhere. <strong>Per-endpoint dependencies</strong> (using <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Depends()</code>) run only on the endpoints that declare them. Authentication uses the second approach because not every endpoint needs it - your login and registration endpoints are public by definition.</P>
    </Section>

    <Section title="The Request Pipeline">
      <P>Let's visualize what happens when a request hits our server. This diagram shows the full pipeline for a request to an admin-only endpoint. Each layer inspects the request and either passes it forward or rejects it with an error.</P>

      <MermaidDiagram title="Request pipeline - each layer can stop the request" chart={`sequenceDiagram
    participant C as 🌐 Client
    participant CORS as 🔀 CORS Middleware
    participant AUTH as 🔑 Auth Guard
    participant ROLE as 🛡️ Role Check
    participant EP as 📍 Endpoint
    participant R as 📤 Response

    C->>CORS: Request arrives
    Note over CORS: Add Access-Control headers<br/>Block disallowed origins
    CORS->>AUTH: ✓ Origin allowed
    Note over AUTH: Extract Bearer token<br/>Verify JWT signature<br/>Check expiration
    AUTH->>ROLE: ✓ Token valid, user: alice
    Note over ROLE: Check user.role >= required<br/>admin >= admin? ✓
    ROLE->>EP: ✓ Role sufficient
    Note over EP: Execute business logic
    EP->>R: Return data
    R->>C: 200 OK + JSON body`} />

      <P>If the JWT is missing or invalid, the pipeline stops at the Auth Guard with a 401 ("I don't know who you are"). If the token is valid but the role is too low, it stops at the Role Check with a 403 ("I know who you are, but you're not allowed here"). The endpoint code never runs unless every guard in the chain passes. This is the same authentication-then-authorization pattern from Chapter 5, but now implemented as real, composable code.</P>
    </Section>

    <Section title="Building the Depends() Chain, Step by Step">
      <P>FastAPI uses a pattern called <strong>dependency injection</strong> via the <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Depends()</code> function. Instead of calling authentication functions manually inside every endpoint, you declare what your endpoint <em>needs</em>, and FastAPI figures out how to provide it. Think of it like a restaurant kitchen: your endpoint says "I need a verified admin user." FastAPI works backward through the chain - to get a verified admin, I first need a verified user; to get a verified user, I first need to extract the token from the header - and executes each step in order.</P>

      <P>Let's build this chain from the bottom up, starting with the simplest layer and composing upward. Each layer depends on the one before it.</P>

      <CodeBlock title="The dependency chain - building up from simple to complex" language="python" code={`from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

# LAYER 1: Extract the token from the Authorization header
# Looks for: "Authorization: Bearer eyJ..."
# Returns just the token string, or raises 401 if missing
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# LAYER 2: Verify the token and return the user payload
def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Depends(oauth2_scheme) runs first → extracts "eyJ..." from header.
    Then this function decodes and verifies it.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Check if token has been blacklisted (logged out)
    if payload.get("jti") in token_blacklist:
        raise HTTPException(status_code=401, detail="Token revoked")

    return payload  # {"sub": "alice", "role": "admin", ...}

# LAYER 3: Check that the user's role is high enough
ROLE_HIERARCHY = {"guest": 0, "user": 1, "admin": 2, "super_admin": 3}

def require_role(minimum_role: str):
    """Factory function - returns a dependency that checks role."""
    def role_checker(user: dict = Depends(get_current_user)):
        # get_current_user runs first → gives us the verified user
        user_level = ROLE_HIERARCHY.get(user.get("role"), 0)
        required_level = ROLE_HIERARCHY[minimum_role]
        if user_level < required_level:
            raise HTTPException(
                status_code=403,
                detail=f"Requires {minimum_role} role"
            )
        return user
    return role_checker`} />

      <P>Layer 1 is a built-in FastAPI utility. <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">OAuth2PasswordBearer</code> knows to look for the <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Authorization: Bearer ...</code> header and extract the token string. If the header is missing, it immediately returns a 401 - your code never runs.</P>

      <P>Layer 2 takes that raw token string and does the real work: decoding it, verifying the cryptographic signature, checking expiration, and checking the blacklist. If everything passes, it returns the decoded payload dictionary containing the user's identity and role.</P>

      <P>Layer 3 is a factory function - it creates a dependency customized to a specific role requirement. When you call <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">require_role("admin")</code>, it returns a new function that first runs <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">get_current_user</code> (which in turn runs <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">oauth2_scheme</code>), then checks if the user's role is high enough. Three layers of security from a single <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Depends()</code> declaration.</P>
    </Section>

    <Section title="What Happens When a Request Arrives?">
      <P>Let's trace a concrete example. Alice (role: admin) sends a request to <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">GET /api/admin/users</code>, which requires the "admin" role. Here's exactly what happens, step by step:</P>

      <div className="border-l-2 border-indigo-400 pl-5 ml-2 space-y-0">
        <FlowStep number="1" title="Request arrives with header: Authorization: Bearer eyJ..." color="blue">
          The raw HTTP request hits the server. FastAPI matches the URL to the <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">list_users</code> endpoint and sees it declares <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Depends(require_role("admin"))</code>. Time to resolve the dependency chain.
        </FlowStep>
        <FlowStep number="2" title='oauth2_scheme extracts the token string: "eyJ..."' color="blue">
          FastAPI reads the Authorization header, strips the "Bearer " prefix, and returns the raw JWT string. If the header was missing, a 401 response would be sent immediately and steps 3-5 would never execute.
        </FlowStep>
        <FlowStep number="3" title="get_current_user decodes and verifies the JWT" color="blue">
          The token is Base64-decoded, the signature is verified against SECRET_KEY, and the expiration is checked against the current time. The blacklist is also consulted. If any check fails: 401. If all pass, the payload is returned: <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">{`{"sub": "alice", "role": "admin", "exp": ...}`}</code>.
        </FlowStep>
        <FlowStep number="4" title='require_role("admin") checks: admin >= admin?' color="blue">
          {"The role checker looks up \"admin\" in the hierarchy (level 2) and compares it to the required \"admin\" (level 2). 2 ≥ 2 is true, so the check passes. If Alice's role were \"user\" (level 1), this would return a 403 Forbidden."}
        </FlowStep>
        <FlowStep number="5" title="Endpoint function executes with the verified user" color="green">
          All guards passed. The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">list_users</code> function receives the verified user dictionary and runs its business logic. It can trust that the user is authenticated and authorized - the guards already proved it.
        </FlowStep>
      </div>
    </Section>

    <Section title="Using the Guards on Endpoints">
      <P>With the dependency chain built, applying it to endpoints is a single line of code. Notice how different endpoints use different levels of protection - public endpoints have no <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Depends()</code>, authenticated endpoints use <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">get_current_user</code>, and admin endpoints use <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">require_role</code>:</P>

      <CodeBlock title="main.py - Applying guards to endpoints" language="python" code={`# Public - no guard needed
@app.post("/api/register")
def register(user: UserRegister):
    return create_user(user)

# Authenticated - any valid token
@app.get("/api/me")
def get_profile(user: dict = Depends(get_current_user)):
    return {"username": user["sub"], "role": user["role"]}

# Admin only - must be admin or higher
@app.get("/api/admin/users")
def list_users(user: dict = Depends(require_role("admin"))):
    return db.get_all_users()

# Super admin only - highest privilege
@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, user: dict = Depends(require_role("super_admin"))):
    return db.delete_user(user_id)`} />

      <P>This is the beauty of the pattern. The endpoint code is clean and focused on business logic. All security concerns are handled by the dependency chain. If you later need to add rate limiting, you add another <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Depends()</code> parameter. If you need to change how tokens are verified, you update <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">get_current_user</code> in one place and every endpoint that uses it is automatically updated.</P>
    </Section>

    <Section title="Global Middleware vs Per-Endpoint Depends()">
      <P>So when do you use global middleware (runs on everything) versus per-endpoint dependencies (runs only where declared)? The rule of thumb: if every request needs it regardless of authentication status, make it global. If it varies by endpoint, use <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Depends()</code>.</P>

      <ComparisonTable headers={['Aspect', 'Global Middleware', 'Per-Endpoint Depends()']} rows={[
        ['Scope', 'Runs on EVERY request', 'Runs only on endpoints that declare it'],
        ['Use case', 'CORS, request logging, rate limiting', 'Auth, role checks, input validation'],
        ['Flexibility', 'Same logic for all routes', 'Different requirements per route'],
        ['Error handling', 'Must handle all cases generically', 'Can return specific errors per endpoint'],
        ['Performance', 'Small overhead on every request', 'Only runs where needed'],
        ['Our projects', 'CORSMiddleware for cross-origin', 'Depends(get_current_user) for auth'],
      ]} />

      <P>CORS is the perfect example of global middleware. Every response needs CORS headers - even error responses, even responses to public endpoints - because without them, the browser will block the frontend from talking to the backend entirely. It would make no sense to add CORS handling endpoint by endpoint.</P>

      <CodeBlock title="Global middleware - CORS example from our projects" language="python" code={`from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# This runs on EVERY request - no exceptions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Our React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Why CORS is global: every response needs these headers,
# regardless of whether the endpoint requires auth.
# Without them, the browser blocks our frontend entirely.`} />

      <InfoBox type="tip" title="The Depends() advantage">
        The beauty of <code className="text-xs font-mono">Depends()</code> is composability. You can stack guards: <code className="text-xs font-mono">Depends(require_role("admin"))</code> automatically includes token extraction AND verification AND role checking - three layers from one declaration. If you later add rate limiting, you add another <code className="text-xs font-mono">Depends()</code> and the chain grows without touching existing code.
      </InfoBox>
    </Section>
  </>)
}
