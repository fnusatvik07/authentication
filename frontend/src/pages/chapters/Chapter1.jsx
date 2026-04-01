import CodeBlock from '../../components/CodeBlock'
import { FlowStep, InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import Exercise from '../../components/Exercise'
import { Network } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter1() {
  return (<>
    <H icon={Network} title="How the Web Works" badge="Chapter 1 · Foundation" color="green" />

    <P>Imagine you're at a restaurant. You sit down, read the menu, and tell the waiter what you want. The waiter walks to the kitchen, tells the chef, and comes back with your food. You didn't walk into the kitchen yourself — the waiter acted as a middleman.</P>

    <P>The web works exactly the same way. Your <strong>browser</strong> is you. The <strong>server</strong> is the kitchen. And <strong>HTTP</strong> (HyperText Transfer Protocol) is the waiter — it carries messages back and forth between your browser and the server.</P>

    <P>Every single thing you do on the web — loading a page, clicking a button, logging in, searching for something — is just your browser sending an HTTP <strong>request</strong> to a server and getting back a <strong>response</strong>. Authentication is no different. When you log in, your browser sends your username and password in a request. The server checks them and sends back a token in the response.</P>

    <Section title="The Request/Response Cycle">
      <P>Let's trace what happens when a user logs into our application. There are two HTTP requests involved — one to log in, and then one to access protected data using the token they received.</P>

      <MermaidDiagram title="Login and then access protected data" chart={`sequenceDiagram
    participant B as 🌐 Browser
    participant S as 🖥️ Server
    participant DB as 🗄️ Database

    Note over B: User clicks "Login"
    B->>S: POST /api/login<br/>{"username": "alice", "password": "secret"}
    S->>DB: SELECT * FROM users WHERE username='alice'
    DB-->>S: {id: 1, password_hash: "$2b$12$..."}
    Note over S: bcrypt.checkpw(password, hash)<br/>✓ Match! Create JWT
    S-->>B: 200 OK<br/>{"access_token": "eyJhbGciOi..."}

    Note over B: Store token in memory
    B->>S: GET /api/me<br/>Authorization: Bearer eyJhbGciOi...
    Note over S: Verify JWT signature<br/>Extract user identity
    S-->>B: 200 OK<br/>{"username": "alice", "role": "admin"}`} />

      <P>Notice the pattern: the browser sends data <strong>to</strong> the server (request), and the server sends data <strong>back</strong> (response). Every interaction follows this cycle. There's no "live connection" — each request is independent. The server doesn't remember who you are between requests, which is why we need tokens.</P>
    </Section>

    <Section title="HTTP Methods — The Verbs of the Web">
      <P>Just like English has verbs (get, create, update, delete), HTTP has methods that tell the server <strong>what you want to do</strong>:</P>

      <ComparisonTable headers={['Method', 'What it does', 'Has request body?', 'Auth example']} rows={[
        ['GET', 'Read/retrieve data', 'No', 'GET /api/me — fetch your profile'],
        ['POST', 'Create something new', 'Yes', 'POST /api/register — create an account'],
        ['PUT', 'Update/replace something', 'Yes', 'PUT /api/users/1/role — change a user\'s role'],
        ['DELETE', 'Remove something', 'No', 'DELETE /api/users/1 — delete an account'],
      ]} />

      <P>In our projects, all authentication endpoints use <strong>POST</strong> (login, register, refresh) because they create something — a user account, a token, or a new token pair. Protected data endpoints use <strong>GET</strong> because they retrieve information.</P>
    </Section>

    <Section title="Status Codes — The Server's Answer">
      <P>When the server responds, it always includes a <strong>status code</strong> — a 3-digit number that tells you what happened. You'll see these constantly when building auth systems:</P>

      <ComparisonTable headers={['Code', 'Name', 'What it means', 'When you\'ll see it']} rows={[
        ['200', 'OK', 'Request succeeded', 'Successful login, data fetch'],
        ['201', 'Created', 'New resource created', 'Successful registration'],
        ['401', 'Unauthorized', 'Not authenticated', 'Missing or invalid JWT token'],
        ['403', 'Forbidden', 'Authenticated but not allowed', 'User role too low for endpoint'],
        ['423', 'Locked', 'Resource locked', 'Account locked after failed logins'],
        ['422', 'Validation Error', 'Bad request data', 'Missing required fields'],
      ]} />

      <InfoBox type="warning" title="401 vs 403 — the most common mistake">
        <strong>401</strong> means "I don't know who you are" (no token, or token is invalid/expired). <strong>403</strong> means "I know who you are, but you're not allowed to do this" (valid token, but your role is too low). Getting this wrong confuses your frontend and your users.
      </InfoBox>
    </Section>

    <Section title="Why This Matters for Authentication">
      <P>Everything we'll build in this course rides on these fundamentals. A login is a POST request. A protected endpoint checks the Authorization header. A 401 means "send a valid token." Understanding HTTP means understanding auth — they're inseparable.</P>

      <P>In the next chapter, we'll zoom into the most important part of an HTTP request for authentication: <strong>headers</strong>. That's where tokens travel.</P>

      <Exercise
        title="Try it yourself: Explore HTTP"
        difficulty="easy"
        tasks={[
          'Open your browser\'s Developer Tools (F12) and go to the Network tab',
          'Visit any website and click on a request — find the status code and Content-Type header',
          'Find a request that returns JSON (Content-Type: application/json)',
          'Start Project 1\'s backend (python main.py) and call GET /api/health in your browser — what status code do you see?',
        ]}
        hints={[
          'In Chrome: F12 → Network tab → click any request → Headers section',
          'The /api/health endpoint returns 200 OK with {"status": "healthy"}',
        ]}
      />
    </Section>
  </>)
}
