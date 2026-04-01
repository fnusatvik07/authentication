import CodeBlock from '../../../components/CodeBlock'
import Diagram, { FlowStep, InfoBox, ComparisonTable } from '../../../components/Diagram'
import MermaidDiagram from '../../../components/MermaidDiagram'

export default function Project3() {
  return (<>
    <Section title="The Problem">
      <P>You're building an AI assistant that can search across multiple knowledge bases — public docs, internal wikis, admin configurations, even a live database. Different users should see different information. An intern shouldn't see salary bands. A guest shouldn't see the internal roadmap. But the LLM doesn't understand access control — it will happily use any data you give it.</P>

      <P>This project solves three hard problems at once:</P>
      <ol className="list-decimal list-inside space-y-2 text-[var(--color-text-secondary)] ml-4 mb-6">
        <li><strong>How do you gate AI tool access by user role?</strong> Each search tool (FAISS, ChromaDB, SQLite) requires a minimum role. The agent only sees tools the user is authorized for.</li>
        <li><strong>How do you make the agent reason step-by-step?</strong> Instead of calling all tools at once, the ReAct pattern (Think → Act → Observe) lets the agent decide what information it needs, call one tool at a time, read the results, and decide whether to call another.</li>
        <li><strong>How do you revoke a JWT token instantly?</strong> JTI-based blacklisting — each token has a unique ID, and logout adds it to a blacklist checked on every request.</li>
      </ol>
    </Section>

    <Section title="Architecture">
      <P>A single FastAPI server handles everything: auth, the ReAct agent, and tool execution. The agent has 4 search tools, each gated by role. Vector databases (FAISS for public, ChromaDB for role-gated) store the document embeddings.</P>

      <MermaidDiagram title="Full system architecture" chart={`sequenceDiagram
    participant F as 🌐 Frontend
    participant S as 🖥️ FastAPI Server
    participant A as 🤖 ReAct Agent
    participant T1 as 📚 FAISS<br/>(public)
    participant T2 as 📂 ChromaDB<br/>(internal)
    participant T3 as 🔒 ChromaDB<br/>(admin)
    participant T4 as 🗄️ SQLite<br/>(super_admin)

    F->>S: POST /chat {message, history} + JWT
    S->>S: Verify JWT + check blacklist
    S->>S: Extract role from JWT claims
    Note over S: RBAC: filter tools for role

    S->>A: query + role + available_tools
    loop ReAct Loop (max 5 steps)
        A->>A: THINK: "What info do I need?"
        A->>T1: ACT: public_search("query")
        T1-->>A: OBSERVE: [results from FAISS]
        A->>A: THINK: "Need more detail..."
        A->>T2: ACT: internal_search("query")
        T2-->>A: OBSERVE: [results from ChromaDB]
        A->>A: THINK: "I have enough info"
    end
    A-->>S: Final answer + steps + sources
    S->>S: Log to audit table
    S-->>F: {answer, tools_used, reasoning_steps, sources}`} />
    </Section>

    <Section title="File Structure">
      <ComparisonTable headers={['Directory', 'File', 'What it does']} rows={[
        ['auth_service/', 'auth.py', 'JWT with JTI for blacklisting, bcrypt, RBAC roles, tool permissions mapping'],
        ['auth_service/', 'database.py', 'Users + refresh tokens + token_blacklist + query_audit_log tables'],
        ['auth_service/', 'models.py', 'ChatQuery (with conversation_history), ChatResponse (with reasoning_steps)'],
        ['rag_agent/', 'agent.py', 'ReAct loop: parse LLM output → execute tools → build observations → loop/answer'],
        ['rag_agent/', 'tools.py', 'FAISS search, ChromaDB search (2 collections), SQL query with injection protection'],
        ['vector_db/', 'setup_vectordb.py', '30+ sample documents seeded into FAISS index + ChromaDB collections'],
        ['', 'main.py', 'All endpoints: auth + chat + tools + admin + audit + logout (blacklisting)'],
        ['', 'test_project3.py', '62 tests: ReAct parser, tool gating, SQL injection, blacklisting, E2E'],
      ]} />
    </Section>

    <Section title="The ReAct Agent — Think → Act → Observe">
      <P>Most "AI agent" tutorials just call all tools at once and dump results into a prompt. That's not agentic — it's batch processing. A real agent <strong>reasons about what information it needs</strong>, makes a decision about which tool to call, reads the results, and then decides what to do next.</P>

      <P>Our agent follows the ReAct pattern (Yao et al., 2022). On each step, it outputs one of two formats:</P>

      <CodeBlock title="LLM output format — action or answer" language="text" code={`# Format A: Agent needs more information
Thought: I need to find infrastructure cost data. The user is an admin,
         so I can use admin_search.
Action: admin_search
Input: AWS infrastructure costs

# Format B: Agent has enough info to answer
Thought: I found the cost breakdown in the admin docs. I have enough to answer.
Answer: Based on internal records, your total monthly AWS spend is $50,000,
        broken down as: EC2 $25k, S3 $8k, RDS $12k, Lambda $3k, CloudFront $2k.`} />

      <P>Here's a real example traced through the loop:</P>

      <MermaidDiagram title="Example: What is our AWS spend? (user role: admin)" chart={`flowchart TD
    Q["❓ Query: 'What is our AWS spend?'<br/>Role: admin → 3 tools available"] --> S1

    S1["🧠 Step 1: THINK<br/>'I need infrastructure cost data.<br/>admin_search covers costs and security.'"]
    S1 --> S2["🔧 Step 2: ACT<br/>admin_search('AWS infrastructure costs')"]
    S2 --> S3["👁️ Step 3: OBSERVE<br/>[infra_costs]: EC2 $25k/mo, S3 $8k/mo,<br/>RDS $12k/mo, Lambda $3k/mo, CloudFront $2k/mo"]
    S3 --> S4["🧠 Step 4: THINK<br/>'I found detailed AWS costs. Total is $50k/mo.<br/>I have enough information to answer.'"]
    S4 --> S5["💬 Step 5: ANSWER<br/>'Your total monthly AWS spend is $50,000...'"]

    style S1 fill:#f5f3ff,stroke:#7c3aed
    style S2 fill:#eef2ff,stroke:#6366f1
    style S3 fill:#ecfdf5,stroke:#059669
    style S4 fill:#f5f3ff,stroke:#7c3aed
    style S5 fill:#fffbeb,stroke:#d97706`} />

      <CodeBlock title="agent.py — The ReAct loop" language="python" code={`MAX_STEPS = 5

def run_agent(query, user_role, username, conversation_history=None):
    # ── RBAC: Filter tools BEFORE the loop ──
    available_tools = get_tools_for_role(user_role)
    # admin → {public_search, internal_search, admin_search}
    # guest → {public_search} only

    system_prompt = build_react_prompt(username, user_role, available_tools)
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history for multi-turn context
    if conversation_history:
        messages.extend(conversation_history[-6:])
    messages.append({"role": "user", "content": query})

    steps = []
    tools_used = []

    for step_num in range(1, MAX_STEPS + 1):
        # Ask the LLM what to do next
        llm_output = call_llm(messages)
        parsed = parse_react_output(llm_output)

        if parsed["type"] == "answer":
            # Agent decided it has enough info
            return {
                "answer": parsed["answer"],
                "tools_used": tools_used,
                "reasoning_steps": steps,
            }

        if parsed["type"] == "action":
            tool_name = parsed["tool"]

            # ── RBAC enforcement INSIDE the loop ──
            if tool_name not in available_tools:
                observation = "ACCESS DENIED: tool requires higher role"
            else:
                results = available_tools[tool_name]["function"](parsed["input"])
                observation = format_results(results)
                tools_used.append(tool_name)

            steps.append({"step": step_num, "type": "observation", "tool": tool_name})
            messages.append({"role": "user", "content": f"Observation: {observation}"})`} />
    </Section>

    <Section title="Tool Gating by Role">
      <P>Each tool requires a minimum role. The agent literally cannot see tools above the user's role level — they're filtered out before the loop starts. Even if the LLM hallucinated a tool name, the RBAC check inside the loop would reject it.</P>

      <ComparisonTable headers={['Tool', 'Vector Store', 'Min Role', 'What it searches', 'guest', 'user', 'admin', 's_admin']} rows={[
        ['public_search', 'FAISS', 'guest', 'Product info, FAQs, API docs, pricing', '✅', '✅', '✅', '✅'],
        ['internal_search', 'ChromaDB', 'user', 'Roadmaps, handbooks, team info, code standards', '❌', '✅', '✅', '✅'],
        ['admin_search', 'ChromaDB', 'admin', 'Infra costs, security policies, compliance, vendor contracts', '❌', '❌', '✅', '✅'],
        ['database_query', 'SQLite', 'super_admin', 'Direct SQL on users table (read-only, keyword-blocked)', '❌', '❌', '❌', '✅'],
      ]} />

      <CodeBlock title="auth.py — Tool permission mapping" language="python" code={`TOOL_PERMISSIONS = {
    "public_search": "guest",        # FAISS index
    "internal_search": "user",       # ChromaDB: internal_docs
    "admin_search": "admin",         # ChromaDB: admin_docs
    "database_query": "super_admin", # Direct SQLite access
}

ROLE_HIERARCHY = {"guest": 0, "user": 1, "admin": 2, "super_admin": 3}

def get_available_tools(user_role: str) -> list[str]:
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    return [
        tool for tool, required_role in TOOL_PERMISSIONS.items()
        if ROLE_HIERARCHY[required_role] <= user_level
    ]

# get_available_tools("admin") → ["public_search", "internal_search", "admin_search"]
# get_available_tools("guest") → ["public_search"]`} />
    </Section>

    <Section title="Token Blacklisting — Instant Revocation">
      <P>JWTs are stateless — the server doesn't track active tokens. This is great for scalability but terrible for logout. If a user logs out, their token is still valid until it expires. The JTI (JWT ID) pattern solves this.</P>

      <P>Every token gets a unique UUID in its <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">jti</code> claim. On logout, we add that JTI to a blacklist table. On <em>every request</em>, we check if the token's JTI is in the blacklist.</P>

      <MermaidDiagram title="JTI blacklisting flow" chart={`sequenceDiagram
    participant C as Client
    participant S as Server
    participant BL as Blacklist Table

    Note over C,BL: Normal request (token not blacklisted)
    C->>S: GET /api/me + Bearer token (jti: "abc-123")
    S->>BL: SELECT * FROM blacklist WHERE jti="abc-123"
    BL-->>S: (no rows — not blacklisted)
    S-->>C: 200 OK — access granted

    Note over C,BL: Logout — blacklist the token
    C->>S: POST /logout + Bearer token (jti: "abc-123")
    S->>BL: INSERT INTO blacklist (jti: "abc-123", expires: ...)
    S-->>C: 200 "Token revoked"

    Note over C,BL: Same token after logout
    C->>S: GET /api/me + Bearer token (jti: "abc-123")
    S->>BL: SELECT * FROM blacklist WHERE jti="abc-123"
    BL-->>S: (found! — blacklisted)
    S-->>C: 401 "Token has been revoked"`} />

      <CodeBlock title="auth.py — JTI blacklisting" language="python" code={`import uuid

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode.update({
        "jti": str(uuid.uuid4()),  # Unique ID for this specific token
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "type": "access",
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")

def decode_access_token(token: str) -> dict:
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    # Check blacklist on EVERY request
    jti = payload.get("jti")
    if jti and is_token_blacklisted(jti):
        raise HTTPException(401, "Token has been revoked")
    return payload

def is_token_blacklisted(jti: str) -> bool:
    conn = get_db()
    row = conn.execute("SELECT 1 FROM token_blacklist WHERE jti=?", (jti,)).fetchone()
    conn.close()
    return row is not None

# POST /api/logout
@app.post("/api/logout")
def logout(current_user = Depends(get_current_user)):
    blacklist_token(current_user["jti"], current_user["exp"])
    return {"message": "Logged out — token revoked"}
    # From this moment, this specific token is rejected everywhere`} />
    </Section>

    <Section title="SQL Injection Protection">
      <P>The <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">database_query</code> tool lets super_admins ask natural language questions about the database, which the LLM converts to SQL. This is powerful but dangerous — we must prevent SQL injection.</P>

      <CodeBlock title="tools.py — SQL safety checks" language="python" code={`def database_query(query: str) -> list[dict]:
    """Execute read-only SQL. Super_admin only."""
    normalized = query.strip().upper()

    # Only SELECT allowed
    if not normalized.startswith("SELECT"):
        return [{"error": "Only SELECT queries allowed"}]

    # Block dangerous keywords
    for keyword in ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER",
                     "CREATE", "TRUNCATE", "ATTACH", "PRAGMA"]:
        if keyword in normalized.split():
            return [{"error": f"Forbidden keyword: {keyword}"}]

    # Block multi-statement injection
    if ";" in query:
        return [{"error": "Multiple statements not allowed"}]

    # Execute the verified query
    conn = sqlite3.connect(DB_PATH)
    results = conn.execute(query).fetchall()
    return results[:20]  # Limit to 20 rows`} />
    </Section>

    <Section title="Testing — 62 Tests">
      <ComparisonTable headers={['Category', 'Tests', 'What they verify']} rows={[
        ['Tool Permissions', '6', 'Each role gets correct tools, unknown role defaults, permissions map valid'],
        ['Role Hierarchy', '3', 'Ordering, higher-passes-lower, lower-denied'],
        ['SQL Injection', '9', 'DROP/DELETE/UPDATE/INSERT blocked, semicolons blocked, PRAGMA/ALTER blocked, SELECT allowed'],
        ['Auth Endpoints', '8', 'Register, login, all seeded users, wrong password, deactivated, lockout, profile, refresh'],
        ['ReAct Parser', '5', 'Parse action, answer, multiline answer, unknown, DB query'],
        ['ReAct Fallback', '2', 'Fallback returns reasoning_steps, handles tool errors'],
        ['Tool Gating', '2', 'Observation formatting, empty results'],
        ['Tools Endpoint', '6', 'Each role sees correct accessible/locked tools, no-auth rejected'],
        ['Chat Endpoint', '6', 'Guest-only tools, reasoning_steps present, admin uses more, history support, audit logging'],
        ['Admin Endpoints', '7', 'Users list (admin+), denied for user/guest, role update, audit log access'],
        ['Token Blacklisting', '4', 'Logout blacklists token, new login works, JTI present, JTIs unique'],
        ['E2E Flows', '4', 'Role upgrade changes tools, register→chat→audit, refresh maintains access'],
      ]} />
    </Section>

    <Section title="What You've Learned">
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { num: '01', text: 'ReAct = Reason + Act. The agent thinks step-by-step, calling one tool at a time. It\'s not just "dump everything into the prompt."' },
          { num: '02', text: 'RBAC tool gating: the agent NEVER sees unauthorized tools. Double enforcement — before the loop AND inside it.' },
          { num: '03', text: 'JTI blacklisting solves "JWT can\'t be revoked." Each token has a unique UUID. Logout adds it to a blacklist. Every request checks.' },
          { num: '04', text: 'Separate vector collections per access level = pre-retrieval filtering. The LLM never even sees unauthorized documents.' },
          { num: '05', text: 'SQL injection protection requires keyword blocking + semicolon blocking + SELECT-only validation. Defense in depth.' },
          { num: '06', text: 'Audit logging records every query with user, role, tools used, and step count. Essential for compliance and debugging.' },
          { num: '07', text: 'Conversation history (last 6 messages) enables follow-up questions: "Tell me more about that" works because the agent has context.' },
          { num: '08', text: 'The frontend shows the ReAct trace — users can expand each step to see exactly how the agent reasoned. Transparency builds trust.' },
        ].map(item => (
          <div key={item.num} className="flex gap-3 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
            <span className="text-[var(--color-primary)] font-bold font-mono text-sm flex-shrink-0">{item.num}</span>
            <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.text}</span>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Common Mistakes & Debugging">
      <ComparisonTable headers={['Problem', 'Symptom', 'Cause', 'Fix']} rows={[
        ['Chat returns fallback (no LLM)', 'Response starts with "[Fallback mode]"', 'OPENAI_API_KEY not set in .env', 'Add OPENAI_API_KEY=sk-... to your .env file and restart'],
        ['Vector DB not found', 'Error about missing FAISS index', 'setup_vectordb.py not run', 'Run: python -m vector_db.setup_vectordb (one-time setup)'],
        ['Agent uses wrong tools', 'Guest user getting admin results', 'Tool gating not working', 'Check get_tools_for_role() — should filter by ROLE_HIERARCHY level'],
        ['Token still works after logout', 'GET /me succeeds after POST /logout', 'Blacklist check not in decode path', 'decode_access_token() must call is_token_blacklisted(jti)'],
        ['SQL injection not blocked', 'database_query runs DROP/DELETE', 'Keyword check bypassed', 'Verify semicolons are blocked AND dangerous keywords are checked as whole words'],
        ['Agent loops forever', 'No response, timeout', 'MAX_STEPS not enforced, or LLM not producing Answer:', 'Check MAX_STEPS=5 and _generate_final_answer() fallback'],
        ['ReAct trace empty', 'reasoning_steps: []', 'Agent answered on first step without acting', 'This is OK — simple questions don\'t need tool calls'],
      ]} />
    </Section>

    <InfoBox type="success" title="You've completed the entire auth journey">
      From a simple password hash in Project 1 → RS256 multi-server architecture in Project 2 → a fully authenticated ReAct RAG agent with token blacklisting in Project 3. Every concept from the 15 chapters is implemented, tested, and working in real code. 165 tests prove it.
    </InfoBox>
  </>)
}

function Section({ title, children }) {
  return <section className="mt-12 mb-8"><h2 className="text-2xl font-bold mb-4 text-[var(--color-text)]">{title}</h2>{children}</section>
}

function P({ children }) {
  return <p className="text-[var(--color-text-secondary)] leading-[1.8] text-[15px] mb-5">{children}</p>
}
