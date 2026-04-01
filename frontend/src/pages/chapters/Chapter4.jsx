import CodeBlock from '../../components/CodeBlock'
import { InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import APIPlayground from '../../components/APIPlayground'
import { Server } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter4() {
  return (<>
    <H icon={Server} title="API Design Fundamentals" badge="Chapter 4 · Foundation" color="green" />

    <P>An API (Application Programming Interface) is the contract between your frontend and backend. When the frontend needs to log in a user, it doesn't call a Python function directly - it makes an HTTP request to a specific URL with a specific format, and gets back a structured response.</P>

    <P>Before we build auth, we need to understand how to design these endpoints. Good API design makes auth predictable, debuggable, and secure.</P>

    <Section title="REST Conventions for Auth">
      <P>REST (Representational State Transfer) is a set of conventions for designing APIs. Here's how auth endpoints typically look across all three of our projects:</P>

      <MermaidDiagram title="Auth API structure - our endpoint map" chart={`flowchart TD
    A["POST /api/register"] -->|"Create user<br/>Hash password"| B["201: {id, username, role}"]
    C["POST /api/login"] -->|"Verify password<br/>Create JWT"| D["200: {access_token, refresh_token}"]
    E["POST /api/refresh"] -->|"Rotate tokens<br/>Revoke old"| F["200: {new_access, new_refresh}"]
    G["GET /api/me"] -->|"Decode JWT<br/>Return profile"| HH["200: {username, email, role}"]
    I["POST /api/logout"] -->|"Blacklist JTI"| J["200: {message: 'logged out'}"]
    style A fill:#ecfdf5,stroke:#059669
    style C fill:#eef2ff,stroke:#6366f1
    style E fill:#fffbeb,stroke:#d97706
    style G fill:#f5f3ff,stroke:#7c3aed
    style I fill:#fef2f2,stroke:#dc2626`} />
    </Section>

    <Section title="Request & Response Bodies">
      <P>APIs communicate in JSON (JavaScript Object Notation). Here's exactly what the data looks like going in and coming out:</P>

      <CodeBlock title="Registration - what the frontend sends and receives" language="json" code={`// POST /api/register - Request body
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "MySecureP@ss123"
}

// Response (201 Created)
// Notice: NO password in the response. Never.
{
  "id": 1,
  "username": "alice",
  "email": "alice@example.com",
  "role": "user"
}`} />

      <CodeBlock title="Login - returns the JWT token pair" language="json" code={`// POST /api/login - Request body
{
  "username": "alice",
  "password": "MySecureP@ss123"
}

// Response (200 OK)
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
  "token_type": "bearer"
}`} />

      <P>Notice the pattern: the <strong>request</strong> sends what's needed (credentials, data), and the <strong>response</strong> returns only what the client needs to continue. No extra data, no internal implementation details, no secrets.</P>
    </Section>

    <Section title="Input Validation with Pydantic">
      <P>FastAPI uses Pydantic models to validate incoming data automatically. If a required field is missing or the wrong type, the client gets a 422 error before your code even runs:</P>

      <CodeBlock title="models.py - Request validation" language="python" code={`from pydantic import BaseModel

class UserRegister(BaseModel):
    username: str      # Required - 422 if missing
    email: str         # Required
    password: str      # Required

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"  # Default value

# FastAPI validates automatically:
@app.post("/api/register", response_model=UserResponse)
def register(user: UserRegister):
    # 'user' is already validated - safe to use
    # If username was missing, client already got a 422
    ...`} />

      <InfoBox type="tip" title="Security principle">
        Auth endpoints should <strong>never return sensitive data</strong>. No password hashes, no internal database IDs that leak info, no secrets. The response_model parameter in FastAPI ensures only declared fields are returned, even if your database query returns more.
      </InfoBox>
    </Section>

    <Section title="Try It - API Playground">
      <P>If you have Project 1's backend running (<code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">cd project-1-basic/backend && python main.py</code>), you can send real requests right here. Try registering a user, then logging in. The token will be auto-captured so you can test protected endpoints.</P>
      <APIPlayground className="my-6" />
    </Section>
  </>)
}
