import CodeBlock from '../../components/CodeBlock'
import { InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import { ShieldCheck } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter5() {
  return (<>
    <H icon={ShieldCheck} title="Authentication vs Authorization" badge="Chapter 5 · Core" color="primary" />

    <P>These two words sound almost identical, and beginners (and even experienced developers) confuse them constantly. But they answer two completely different questions, happen at different times, and fail with different error codes. Getting this distinction right is fundamental.</P>

    <P><strong>Authentication (AuthN)</strong> answers: "Who are you?" — proving identity. It's the bouncer checking your ID at the door.</P>
    <P><strong>Authorization (AuthZ)</strong> answers: "What can you do?" — checking permissions. It's the VIP list that decides which rooms you can enter once you're inside.</P>

    <Section title="The Two-Step Process">
      <P>Every protected request goes through both steps, in order. Authentication happens first. If it fails, we stop immediately (401). Only if authentication succeeds do we check authorization. If that fails, we return 403.</P>

      <MermaidDiagram title="Every request follows this pipeline" chart={`flowchart LR
    A["📨 Request arrives"] --> B{"🔑 Valid JWT?"}
    B -->|"No token or<br/>invalid/expired"| C["❌ 401 Unauthorized<br/>'Who are you?'"]
    B -->|"Valid token<br/>User: alice, Role: user"| D{"🛡️ Role ≥ required?"}
    D -->|"user < admin"| E["❌ 403 Forbidden<br/>'Not allowed'"]
    D -->|"admin ≥ admin ✓"| F["✅ 200 OK<br/>Access granted"]
    style C fill:#fef2f2,stroke:#dc2626
    style E fill:#fffbeb,stroke:#d97706
    style F fill:#ecfdf5,stroke:#059669`} />
    </Section>

    <Section title="A Concrete Example">
      <P>Let's say Alice (role: user) and Bob (role: admin) both try to access the admin panel:</P>

      <ComparisonTable headers={['Scenario', 'Authentication', 'Authorization', 'Result']} rows={[
        ['No token sent', '❌ Fails — no identity', 'Never reached', '401 Unauthorized'],
        ['Expired token', '❌ Fails — token expired', 'Never reached', '401 Unauthorized'],
        ['Alice (role: user)', '✅ Valid token, identity: alice', '❌ user < admin', '403 Forbidden'],
        ['Bob (role: admin)', '✅ Valid token, identity: bob', '✅ admin ≥ admin', '200 OK'],
      ]} />
    </Section>

    <Section title="In Code — Both Steps Together">
      <CodeBlock title="FastAPI — authentication then authorization" language="python" code={`from fastapi import Depends, HTTPException

# AUTHENTICATION: verify JWT, extract identity
def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")  # AuthN failed
    return payload  # Returns: {"sub": "alice", "role": "user", ...}

# AUTHORIZATION: check if role is high enough
def require_role(minimum_role: str):
    def checker(user = Depends(get_current_user)):  # AuthN runs first
        if ROLE_HIERARCHY[user["role"]] < ROLE_HIERARCHY[minimum_role]:
            raise HTTPException(status_code=403, detail="Insufficient role")  # AuthZ failed
        return user
    return checker

# Both combined:
@app.get("/api/admin-panel")
def admin_panel(user = Depends(require_role("admin"))):
    # If we reach here: user is authenticated AND authorized
    return {"message": f"Welcome admin {user['sub']}"}`} />

      <InfoBox type="warning" title="The most common auth bug">
        Returning 401 when you should return 403 (or vice versa). This confuses your frontend — a 401 should trigger a token refresh or redirect to login. A 403 should show "access denied." If you mix them up, users get sent to the login page when they're actually logged in but just don't have permission.
      </InfoBox>
    </Section>

    <Section title="Why This Matters for RAG Systems">
      <P>In Project 3, we apply this same two-step process to AI agent tools. First, we authenticate the user (verify their JWT). Then, we authorize which tools the agent can use based on their role. A user with "admin" role gets 3 tools; a "guest" gets 1. The LLM never even sees the tools the user isn't authorized for.</P>
    </Section>
  </>)
}
