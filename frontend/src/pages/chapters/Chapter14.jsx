import CodeBlock from '../../components/CodeBlock'
import { InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import { Bot } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter14() {
  return (<>
    <H icon={Bot} title="Agentic Systems & Tool Auth" badge="Chapter 14 · Advanced" color="purple" />

    <P>Most "AI agent" tutorials do something like this: call every tool, dump all results into a prompt, ask the LLM to summarize. That's not an agent - that's a batch processor with an LLM wrapper. A real agent <strong>reasons</strong>. It looks at a question, decides which tool to call, examines the result, and then decides what to do next. It might call one tool, three tools, or zero tools depending on what it learns along the way. The key difference is the loop: an agent makes decisions at each step based on what it has observed so far.</P>

    <P>This reasoning ability is what makes agents powerful - and what makes them dangerous. A chatbot that generates wrong text is embarrassing. An agent that calls the wrong API can delete data, leak secrets, or rack up cloud bills. When you give an LLM the ability to <em>act</em> in the world, authentication and authorization become existential requirements, not nice-to-haves.</P>

    <Section title="The ReAct Pattern: Think, Act, Observe">
      <P>The pattern behind Project 3's agent comes from a 2022 paper by Yao et al. called ReAct: Synergizing Reasoning and Acting. The core idea is elegant: instead of asking the LLM to produce a final answer in one shot, you let it alternate between <strong>thinking</strong> (reasoning in natural language about what to do), <strong>acting</strong> (calling a tool), and <strong>observing</strong> (reading the tool's result). Each cycle gives the model new information, and it keeps looping until it has enough to answer the question.</P>

      <P>Think of it like a detective investigating a case. The detective doesn't gather all the evidence at once and then think. They form a hypothesis (think), interview a witness or check a record (act), learn something new (observe), and then revise their hypothesis. Some cases are solved in one interview. Others take five. The detective doesn't know upfront - they follow the evidence.</P>

      <P>Here's what the format actually looks like in the LLM's output. The model produces structured text with specific prefixes that our code parses:</P>

      <CodeBlock title="The three phases of a ReAct step" language="text" code={`Thought: The user wants AWS spending data. I should use the analytics tool
         to get current month figures.
Action: run_analytics
Action Input: {"metric": "aws_spend", "period": "current_month"}

--- tool executes, returns result ---

Observation: {"total": "$12,450", "trend": "+8%", "top": ["EC2: $7,200", "S3: $2,100"]}

Thought: I now have the spending data. I can give the user a complete answer.
Final Answer: Your AWS spend this month is $12,450, up 8% from last month.
              The largest contributors are EC2 ($7,200) and S3 ($2,100).`} />

      <P>The "Thought" lines are the model reasoning out loud. The "Action" and "Action Input" lines are structured tool calls that our code extracts and executes. The "Observation" is the tool's result, which we feed back into the conversation. And "Final Answer" signals that the agent is done reasoning and ready to respond to the user. Our code parses these prefixes with simple string matching and regex - nothing fancy, but it works reliably.</P>
    </Section>

    <Section title="The Full Agent Loop with Authorization">
      <P>Now let's see how authentication fits into this loop. The critical insight is that we enforce tool access at <strong>two separate points</strong> - not one. We call this double enforcement, and understanding why both points matter is essential to building secure agents.</P>

      <MermaidDiagram title="ReAct agent loop with tool authorization" chart={`flowchart TD
    A["📨 User question arrives<br/>'What is our AWS spend this month?'"] --> B["🔑 Verify JWT + Extract role"]
    B --> C["🔧 Filter tools by role<br/>admin → 3 tools available"]
    C --> D["🤔 THINK<br/>LLM reasons about the question<br/>'I need to check analytics data'"]
    D --> E{"📋 Action or Final Answer?"}
    E -->|"Action: run_analytics"| F["⚡ ACT<br/>Execute tool: run_analytics<br/>Params: {metric: 'aws_spend', period: 'month'}"]
    F --> G["👁️ OBSERVE<br/>Tool returned: {spend: '$12,450', trend: '+8%'}"]
    G --> D
    E -->|"Final Answer"| H["✅ RESPOND<br/>'Your AWS spend this month is $12,450,<br/>up 8% from last month.'"]
    style B fill:#eef2ff,stroke:#6366f1
    style C fill:#fffbeb,stroke:#d97706
    style D fill:#f5f3ff,stroke:#7c3aed
    style F fill:#ecfdf5,stroke:#059669
    style H fill:#ecfdf5,stroke:#059669`} />

      <P><strong>Enforcement Point 1: Before the loop starts.</strong> When the user's request arrives, we verify their JWT, extract their role, and build the system prompt with only the tools that role is allowed to use. A guest sees 1 tool. A user sees 2. An admin sees 3. A super_admin sees all 4. The LLM literally cannot reason about tools it doesn't know exist - they're not in its prompt.</P>

      <ComparisonTable headers={['Tool', 'guest (L0)', 'user (L1)', 'admin (L2)', 'super_admin (L3)']} rows={[
        ['search_docs', '✅', '✅', '✅', '✅'],
        ['get_user_profile', '---', '✅', '✅', '✅'],
        ['run_analytics', '---', '---', '✅', '✅'],
        ['manage_system', '---', '---', '---', '✅'],
      ]} />

      <P><strong>Enforcement Point 2: Inside the loop, before execution.</strong> Even after filtering the prompt, we check the user's role again every time the LLM outputs a tool call. Why? Because LLMs are unpredictable. A model might hallucinate a tool name it encountered during training. It might construct a tool name from context clues in the conversation. Prompt injection attacks could try to trick the model into calling restricted tools. The second check catches all of these: if the LLM outputs <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Action: manage_system</code> and the user is only an admin, the execution layer returns an error message instead of running the tool.</P>
    </Section>

    <Section title="The Agent Code, Explained">
      <P>Let's walk through the actual implementation. The function below is the heart of Project 3's agent. Pay attention to the two enforcement points - they're marked with comments - and notice how the ReAct loop is really just a for loop with string parsing inside.</P>

      <CodeBlock title="agent.py - The ReAct loop with double enforcement" language="python" code={`import re

def run_agent(question: str, user: dict) -> str:
    """Execute a ReAct agent loop with role-based tool gating.

    Double enforcement:
    1. BEFORE LOOP: filter tools in the system prompt
    2. INSIDE LOOP: verify role before executing any tool call
    """
    role = user["role"]
    user_level = ROLE_HIERARCHY.get(role, 0)

    # ENFORCEMENT POINT 1: Filter tools for the system prompt
    available_tools = get_available_tools(role)
    tool_descriptions = "\\n".join(available_tools)

    system_prompt = f"""You are a helpful assistant. You can use these tools:
{tool_descriptions}

To use a tool, respond with:
Thought: <your reasoning>
Action: <tool_name>
Action Input: <parameters as JSON>

When you have enough information, respond with:
Thought: <your reasoning>
Final Answer: <your response to the user>"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question},
    ]

    # The ReAct loop - max 5 iterations to prevent infinite loops
    for i in range(5):
        response = llm.invoke(messages)
        text = response.content

        # Check if the agent wants to use a tool
        action_match = re.search(r"Action:\\s*(.+)", text)
        input_match = re.search(r"Action Input:\\s*(.+)", text)

        if action_match and input_match:
            tool_name = action_match.group(1).strip()
            tool_input = input_match.group(1).strip()

            # ENFORCEMENT POINT 2: Verify role before execution
            tool = TOOL_REGISTRY.get(tool_name)
            if not tool:
                observation = f"Error: Unknown tool '{tool_name}'"
            elif ROLE_HIERARCHY[tool["min_role"]] > user_level:
                observation = f"Error: Insufficient permissions for '{tool_name}'"
            else:
                # Execute the authorized tool
                observation = tool["function"](tool_input)

            # Feed observation back into the loop
            messages.append({"role": "assistant", "content": text})
            messages.append({"role": "user", "content": f"Observation: {observation}"})

        elif "Final Answer:" in text:
            # Agent is done - extract and return the answer
            answer = text.split("Final Answer:")[-1].strip()
            return answer

    return "I was unable to find an answer within the allowed steps."`} />

      <P>The parsing is intentionally simple: two regex patterns look for <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Action:</code> and <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Action Input:</code> in the LLM's output. If both are found, we have a tool call. If the text contains <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">Final Answer:</code>, the agent is done. If neither pattern matches (the LLM produced unstructured text), the loop continues and the model gets another chance. The 5-iteration cap prevents infinite loops - if the agent can't figure it out in 5 tool calls, it admits defeat gracefully rather than burning API credits forever.</P>
    </Section>

    <Section title="Traced Example: Admin Asks About AWS Spend">
      <P>Let's trace a complete request from start to finish. An admin user (role level 2) asks "What's our AWS spend this month?" and we follow every step of the agent's reasoning.</P>

      <CodeBlock title="Step-by-step trace of an agent query" language="python" code={`# User: admin (level 2), Question: "What's our AWS spend this month?"

# Step 1: JWT verified → role: "admin", level: 2
# Available tools: search_docs, get_user_profile, run_analytics (3/4)

# Step 2: LLM receives system prompt with 3 tools listed
# LLM output:
#   Thought: The user wants AWS spending data. I should use run_analytics.
#   Action: run_analytics
#   Action Input: {"metric": "aws_spend", "period": "current_month"}

# Step 3: Enforcement check - run_analytics requires "admin" (level 2)
# User is admin (level 2) → 2 >= 2 → ALLOWED ✓
# Tool executes → returns: {"total": "$12,450", "trend": "+8%", ...}

# Step 4: Observation fed back to LLM
# LLM output:
#   Thought: I have the AWS spend data. I can answer the question now.
#   Final Answer: Your AWS spend this month is $12,450, which is up 8%
#   from last month. The largest contributors are EC2 ($7,200) and
#   S3 ($2,100).

# If a "user" (level 1) asked the same question:
# Step 2: run_analytics NOT in system prompt (filtered out)
# LLM would only see: search_docs, get_user_profile
# LLM might try search_docs for AWS info → finds nothing sensitive
# Final Answer: "I don't have access to analytics data for your role."`} />

      <P>The contrast between the admin's experience and the regular user's experience is the whole point. Same question, same agent code, same LLM - but different tools available because of different roles. The admin gets a precise answer because they have access to the analytics tool. The regular user gets a graceful "I can't do that" because the tool doesn't exist in their prompt. No error, no leak, no confusion.</P>
    </Section>

    <Section title="Why Conversation History Matters">
      <P>Notice that the agent appends every exchange to the <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">messages</code> list. This isn't just for the current question - it's what enables follow-up questions. If the admin follows up with "How does that compare to last quarter?", the agent already has the current month's data in its conversation history. It might call the analytics tool again with a different time period, or it might answer from the data it already has. The conversation state gives the agent context, just like a human assistant who remembers what you discussed five minutes ago.</P>

      <P>But conversation history has a security implication too: the history contains tool outputs, which contain data. If a user's role changes mid-session (say, an admin gets demoted), the conversation history still contains results from admin-level tools. In production, you'd want to invalidate the session when roles change, forcing a fresh start with the new tool set. Our project handles this by tying each agent session to a single JWT - when the token expires, the session ends.</P>

      <InfoBox type="tip" title="Why double enforcement matters">
        LLMs are unpredictable. Even with tools filtered from the prompt, a model could hallucinate a tool name it saw during training, or a prompt injection attack could try to trick it into calling restricted tools. The second enforcement point (inside the loop) catches these cases: the execution layer checks the role again before running anything. Never rely on prompt engineering alone for security. Prompts are suggestions to the model. Code is law.
      </InfoBox>
    </Section>
  </>)
}
