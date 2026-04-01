import CodeBlock from '../../components/CodeBlock'
import { InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import { ShieldCheck } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter10() {
  return (<>
    <H icon={ShieldCheck} title="RBAC & ABAC Patterns" badge="Chapter 10 · Intermediate" color="orange" />

    <P>Walk into any hospital and you will see the same building serving radically different experiences. The receptionist at the front desk can pull up patient names and appointment times — enough to check people in and direct them to the right floor. A nurse on the ward can see vital signs, medication schedules, and care notes — enough to deliver treatment safely. A doctor can see everything the nurse sees, plus full diagnostic records, lab results, and the authority to prescribe new medication. Meanwhile, the billing administrator can access insurance claims and payment records but has no business reading anyone's blood-pressure history.</P>

    <P>Same hallways, same database, but each person sees a completely different slice of information. Nobody sat down and assigned permissions to each individual employee. Instead, the hospital defined <strong>roles</strong> — receptionist, nurse, doctor, billing admin — and attached permissions to those roles. When a new nurse is hired, you assign them the "nurse" role and they instantly inherit every permission a nurse needs. This is <strong>Role-Based Access Control (RBAC)</strong>, and it is the most common authorization pattern in software.</P>

    <P>RBAC matters because the alternative does not scale. Imagine managing permissions for 500 employees one at a time: "Alice can read vitals, Alice can update care notes, Alice can view medication schedules..." Now multiply that by every new feature you add. With roles, you define the permissions once per role, and every user assigned to that role gets them automatically. Our projects use this exact pattern.</P>

    <Section title="The Role Hierarchy — Higher Roles Inherit Lower Permissions">
      <P>A key insight that simplifies RBAC enormously is the concept of a <strong>role hierarchy</strong>. In our system, roles are not independent buckets — they are stacked. A "user" can do everything a "guest" can, plus more. An "admin" can do everything a "user" can, plus more. You do not need to assign each permission individually to each role. You just assign a level, and anything at or below that level is included.</P>

      <P>Think of it like security clearance levels in government. If you have "Top Secret" clearance, you can also read "Secret" and "Confidential" documents. You do not need three separate clearances. One number captures your entire access level.</P>

      <MermaidDiagram title="Role hierarchy — higher roles inherit all lower permissions" chart={`flowchart BT
    G["👁️ guest<br/>Level 0<br/>View public data only"] --> U["👤 user<br/>Level 1<br/>+ Own profile, basic tools"]
    U --> A["🛡️ admin<br/>Level 2<br/>+ Manage users, all tools"]
    A --> SA["⚡ super_admin<br/>Level 3<br/>+ Delete users, system config"]
    style G fill:#f8fafc,stroke:#94a3b8
    style U fill:#eef2ff,stroke:#6366f1
    style A fill:#fffbeb,stroke:#d97706
    style SA fill:#fef2f2,stroke:#dc2626`} />

      <P>The hierarchy is numeric: guest=0, user=1, admin=2, super_admin=3. To check permissions, we simply compare numbers. If an endpoint requires "admin" (level 2), any user with level 2 or higher (admin, super_admin) can access it. Anyone below (guest, user) gets a 403. This single comparison replaces what would otherwise be a sprawling list of per-permission checks.</P>
    </Section>

    <Section title="The require_role() Dependency — Line by Line">
      <P>This is the function that enforces authorization across all three projects. It looks small, but every line makes a deliberate security decision. Let us walk through it carefully.</P>

      <CodeBlock title="auth.py — Role enforcement in our projects" language="python" code={`ROLE_HIERARCHY = {
    "guest": 0,
    "user": 1,
    "admin": 2,
    "super_admin": 3,
}

def require_role(minimum_role: str):
    """Create a FastAPI dependency that enforces a minimum role.

    Usage: Depends(require_role("admin"))

    The chain of execution:
    1. oauth2_scheme extracts the Bearer token
    2. get_current_user verifies the JWT and returns the payload
    3. This function checks if the user's role is high enough
    """
    def role_checker(user: dict = Depends(get_current_user)):
        user_role = user.get("role", "guest")
        if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY[minimum_role]:
            raise HTTPException(
                status_code=403,
                detail=f"This endpoint requires '{minimum_role}' role. "
                       f"Your role: '{user_role}'"
            )
        return user
    return role_checker

# Using it on endpoints:
@app.get("/api/users")
def list_users(user=Depends(require_role("admin"))):
    """Only admin and super_admin can list all users."""
    return db.get_all_users()

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, user=Depends(require_role("super_admin"))):
    """Only super_admin can delete users."""
    return db.delete_user(user_id)`} />

      <P>The outer function <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">require_role("admin")</code> is a factory. It takes the minimum role name and returns an inner function that FastAPI will call on every request. This pattern — a function that returns a function — is what lets us write <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Depends(require_role("admin"))</code> with different role names on different endpoints.</P>

      <P>Inside the inner function, <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">user.get("role", "guest")</code> defaults to "guest" if the JWT payload somehow has no role field. This is a safety net — if something goes wrong, the user gets the lowest possible access, not the highest. The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">ROLE_HIERARCHY.get(user_role, 0)</code> call does the same thing for unrecognized roles: treat them as level 0. Fail closed, never fail open.</P>

      <P>The comparison itself is a single line: if the user's numeric level is less than the required level, raise a 403. Notice it is a less-than check, not an equality check. This is what makes the hierarchy work — an admin (level 2) passes a check that requires user (level 1), because 2 is not less than 1.</P>
    </Section>

    <Section title="Resource-Level Access Control — Beyond Endpoint Gating">
      <P>Protecting an endpoint with <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">require_role</code> is the first line of defense. But real applications need finer control. Consider a document management system: all authenticated users can access the <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">/api/documents</code> endpoint, but what they see should depend on who they are. A guest sees only public documents. A regular user sees public documents plus their own private ones. An admin sees everything.</P>

      <P>This is <strong>resource-level access control</strong> — not just deciding whether someone can reach an endpoint, but filtering the actual database results based on their identity and role. The endpoint is the same; the data returned is different.</P>

      <CodeBlock title="Filtering DB queries by role and ownership" language="python" code={`@app.get("/api/documents")
def get_documents(user=Depends(get_current_user)):
    """Return documents based on user's role.

    - guest: public documents only
    - user: public + their own documents
    - admin: all documents
    """
    role = user["role"]
    username = user["sub"]

    if ROLE_HIERARCHY[role] >= ROLE_HIERARCHY["admin"]:
        # Admins see everything
        return db.get_all_documents()
    elif role == "user":
        # Regular users see public + their own
        return db.get_documents(
            owner=username,
            include_public=True
        )
    else:
        # Guests see only public
        return db.get_documents(public_only=True)`} />

      <InfoBox type="danger" title="Never trust the client">
        A common mistake: the frontend hides the "Delete User" button for non-admins, and the developer thinks that is enough. It is not. Anyone can send a raw HTTP request with <code className="text-xs font-mono">curl</code> or Postman. <strong>Every permission check must happen on the server</strong>. The frontend hides buttons for UX convenience. The backend enforces security.
      </InfoBox>
    </Section>

    <Section title="RBAC vs ABAC — When Roles Are Not Enough">
      <P>RBAC works beautifully when your access rules are simple: "admins can do X, users can do Y." But what happens when the rules get more nuanced? "Doctors can view patient records, but only in their own department, and only during work hours." That rule depends on the doctor's department, the patient's department, and the current time — three attributes that have nothing to do with a simple role level.</P>

      <P><strong>Attribute-Based Access Control (ABAC)</strong> handles these cases. Instead of checking a single role, an ABAC system evaluates a policy against multiple attributes of the user, the resource, and the environment. RBAC is actually a subset of ABAC — "role" is just one attribute among many.</P>

      <ComparisonTable headers={['Aspect', 'RBAC (Role-Based)', 'ABAC (Attribute-Based)']} rows={[
        ['Decision based on', 'User\'s role only', 'Any attribute (role, time, IP, ownership...)'],
        ['Complexity', 'Simple — role >= required', 'Complex — policy engine evaluates rules'],
        ['Example rule', '"Only admins can delete users"', '"Doctors can view records in their department during work hours"'],
        ['Scalability', 'Works well up to ~10 roles', 'Scales to arbitrary policy complexity'],
        ['Our projects', 'Projects 1, 2, and 3', 'Project 3 partially (tool gating by role + context)'],
        ['Implementation', 'Numeric hierarchy comparison', 'Policy engine (OPA, Cedar, custom)'],
      ]} />
    </Section>

    <Section title="How This Connects to Tool Gating in Project 3">
      <P>Here is where RBAC gets interesting for AI applications. In Project 3, we build a ReAct agent — an LLM that can call tools (search documents, look up user profiles, run analytics). Each of those tools is a <strong>resource with a minimum role requirement</strong>, exactly like an API endpoint. The difference is that the gating happens before the LLM even sees the tool list.</P>

      <P>When a user sends a message to the agent, the backend checks their JWT, extracts their role, and filters the tool registry. A guest gets one tool. A user gets two. An admin gets three. The LLM's system prompt only includes the tools the user is authorized to use. The model literally cannot call a tool it does not know exists.</P>

      <CodeBlock title="Tool gating by role — from Project 3" language="python" code={`TOOL_REGISTRY = {
    "search_docs": {
        "description": "Search the knowledge base",
        "min_role": "guest",     # Everyone can search
        "function": search_docs,
    },
    "get_user_profile": {
        "description": "Look up a user's profile",
        "min_role": "user",      # Must be at least a user
        "function": get_user_profile,
    },
    "run_analytics": {
        "description": "Run analytics queries",
        "min_role": "admin",     # Admin only
        "function": run_analytics,
    },
    "manage_system": {
        "description": "Modify system configuration",
        "min_role": "super_admin",
        "function": manage_system,
    },
}

def get_tools_for_role(role: str) -> dict:
    """Filter tools to only those the user's role can access."""
    user_level = ROLE_HIERARCHY.get(role, 0)
    return {
        name: tool for name, tool in TOOL_REGISTRY.items()
        if ROLE_HIERARCHY[tool["min_role"]] <= user_level
    }`} />

      <P>This is the same <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">ROLE_HIERARCHY</code> comparison from the endpoint protection code, applied to a completely different context. The pattern is identical: compare the user's level to the resource's required level. Whether the resource is an API endpoint, a database query filter, or an AI agent tool, RBAC works the same way.</P>
    </Section>
  </>)
}
