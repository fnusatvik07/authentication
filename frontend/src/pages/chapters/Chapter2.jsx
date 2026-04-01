import CodeBlock from '../../components/CodeBlock'
import { FlowStep, InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import { FileCode } from 'lucide-react'
import { H, P, Section, Code } from './shared'

export default function Chapter2() {
  return (<>
    <H icon={FileCode} title="Headers, Cookies & Requests" badge="Chapter 2 · Foundation" color="green" />

    <P>In the last chapter, we saw that HTTP is just requests and responses. But there's a critical detail we glossed over: each request carries <strong>metadata</strong> in addition to the actual data. This metadata lives in <strong>headers</strong> — and headers are where authentication happens.</P>

    <P>Think of it this way: when you mail a package, the box contains the actual item (the body). But the shipping label on the outside tells the post office where it's going, who sent it, and how to handle it. HTTP headers are the shipping label on every web request.</P>

    <Section title="What an HTTP Request Actually Looks Like">
      <P>Let's look at a real login request, piece by piece. When your browser sends a login form, this is what goes over the network:</P>

      <CodeBlock title="A complete HTTP request — the login" language="http" code={`POST /api/login HTTP/1.1          ← Method + Path + Protocol
Host: localhost:8000               ← Which server to talk to
Content-Type: application/json     ← "The body is JSON"
Accept: application/json           ← "Send me back JSON"
User-Agent: Mozilla/5.0            ← Browser identification

{                                  ← This is the BODY
  "username": "alice",
  "password": "secret123"
}`} />

      <P>The first line tells the server <em>what you want to do</em> (POST to /api/login). The headers tell the server <em>how to interpret the request</em>. The body is the actual data. After login, the server sends back a JWT token. From that point on, every request you make includes that token in a special header.</P>
    </Section>

    <Section title="The Authorization Header — Where Tokens Live">
      <P>This is the single most important header for authentication. After you log in and receive a JWT token, you include it in every subsequent request like this:</P>

      <CodeBlock title="Sending a JWT with every API request" language="http" code={`GET /api/me HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbGljZSJ9.abc123
                │       │
                │       └── The actual JWT token
                └── "Bearer" — the auth scheme (always this for JWT)`} />

      <P>The format is always <Code>Authorization: Bearer &lt;token&gt;</Code>. The word "Bearer" tells the server "I'm bearing (carrying) this token as proof of my identity." The server extracts the token, verifies its signature, checks if it's expired, and extracts your identity (username, role) from the payload.</P>

      <P>Here's how you actually send it from JavaScript:</P>

      <CodeBlock title="Frontend code — attaching the token" language="javascript" code={`// After login, store the token in a variable (NOT localStorage!)
const token = loginResponse.access_token;

// Include it in every API request
const response = await fetch('http://localhost:8000/api/me', {
  method: 'GET',
  headers: {
    'Authorization': \`Bearer \${token}\`,  // ← This is the key line
    'Content-Type': 'application/json',
  },
});

const profile = await response.json();
// { "username": "alice", "role": "admin" }`} />
    </Section>

    <Section title="Headers You'll See in Auth Systems">
      <ComparisonTable headers={['Header', 'Direction', 'Purpose', 'Example value']} rows={[
        ['Authorization', '→ Request', 'Send your JWT token', 'Bearer eyJhbGci...'],
        ['Content-Type', '→ Request', 'Format of the request body', 'application/json'],
        ['Set-Cookie', '← Response', 'Server tells browser to save a cookie', 'refresh_token=abc; HttpOnly'],
        ['Cookie', '→ Request', 'Browser automatically sends saved cookies', 'refresh_token=abc'],
        ['WWW-Authenticate', '← Response', 'Tells client how to authenticate', 'Bearer realm="api"'],
        ['Access-Control-Allow-Origin', '← Response', 'CORS — which frontends can call this API', 'http://localhost:3000'],
      ]} />
    </Section>

    <Section title="Cookies vs Authorization Header">
      <P>There are two main ways to send auth credentials: the <strong>Authorization header</strong> (you manually attach the token) or <strong>cookies</strong> (the browser automatically attaches them). Each has trade-offs:</P>

      <ComparisonTable headers={['', 'Authorization Header', 'HTTP-Only Cookie']} rows={[
        ['How it\'s sent', 'You write code to attach it', 'Browser sends it automatically'],
        ['XSS attack risk', 'Token in JS memory — safe if careful', 'JS literally cannot read it — safer'],
        ['CSRF attack risk', 'Immune — not auto-sent', 'Vulnerable — need CSRF token protection'],
        ['Cross-domain APIs', 'Works easily', 'Complex (SameSite, CORS credentials)'],
        ['Mobile apps', 'Works naturally', 'Doesn\'t apply'],
        ['Best for', 'SPAs, APIs, mobile apps', 'Traditional server-rendered websites'],
      ]} />

      <InfoBox type="info" title="What we use in our projects">
        All 3 projects use the <strong>Authorization header</strong> approach. This is the modern standard for SPAs and APIs — it's simpler, immune to CSRF, and works across domains. Cookies are still valid for server-rendered apps, but for learning JWT, headers are cleaner.
      </InfoBox>
    </Section>

    <Section title="Try It Yourself — Browser Dev Tools">
      <P>You can see all of this in action right now. Open your browser's Developer Tools (F12 → Network tab), visit any website, and click on a request. You'll see the request headers, response headers, status code, and body. When you build our projects, use this to debug auth issues — if you get a 401, check if the Authorization header is actually being sent.</P>

      <InfoBox type="tip" title="Debugging tip">
        If your protected endpoint returns 401, open the Network tab and check: (1) Is the Authorization header present? (2) Does it start with "Bearer "? (3) Is the token actually there and not "undefined"? 90% of auth bugs are caught this way.
      </InfoBox>
    </Section>
  </>)
}
