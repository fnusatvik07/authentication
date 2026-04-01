"""ReAct Agent: Reason + Act loop for authenticated RAG.

ReAct Pattern (Yao et al., 2022):
    1. THOUGHT  — The agent reasons about what it knows and what it needs
    2. ACTION   — The agent picks a tool and arguments to call
    3. OBSERVATION — The tool returns results
    4. Repeat until the agent has enough info
    5. ANSWER   — The agent produces a final response

Each iteration is a "step". The agent's available tools are determined
by the user's JWT role — enforced BEFORE the loop starts.
"""

import os
import json

from openai import OpenAI

from rag_agent.tools import TOOL_REGISTRY

ROLE_HIERARCHY = {"guest": 0, "user": 1, "admin": 2, "super_admin": 3}
MAX_STEPS = 5  # Safety limit to prevent infinite loops


def get_tools_for_role(user_role: str) -> dict:
    """Return tools available for the given role level."""
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    return {
        name: info for name, info in TOOL_REGISTRY.items()
        if ROLE_HIERARCHY.get(info["min_role"], 0) <= user_level
    }


def run_agent(
    query: str,
    user_role: str,
    username: str,
    conversation_history: list[dict] | None = None,
) -> dict:
    """Run the ReAct agent loop.

    Args:
        query: User's natural language question
        user_role: Role from verified JWT
        username: Username from verified JWT
        conversation_history: Previous messages for multi-turn context

    Returns:
        dict with answer, tools_used, sources, reasoning_steps, user_role
    """
    available_tools = get_tools_for_role(user_role)

    # No API key → fallback mode (execute all tools, return raw results)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _fallback_agent(query, available_tools, user_role)

    client = OpenAI(api_key=api_key)
    tool_descriptions = _format_tool_descriptions(available_tools)

    # Build system prompt for ReAct
    system_prompt = _build_system_prompt(username, user_role, tool_descriptions)

    # Build message history
    messages = [{"role": "system", "content": system_prompt}]
    if conversation_history:
        for msg in conversation_history[-6:]:  # Keep last 6 messages for context
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": query})

    # ReAct loop
    steps = []
    tools_used = []
    all_sources = []

    for step_num in range(1, MAX_STEPS + 1):
        # Ask the LLM for the next thought/action
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.1,
                max_tokens=800,
            )
            llm_output = response.choices[0].message.content.strip()
        except Exception as e:
            steps.append({"step": step_num, "type": "error", "content": str(e)})
            break

        messages.append({"role": "assistant", "content": llm_output})

        # Parse the LLM output into thought/action/answer
        parsed = _parse_react_output(llm_output)

        if parsed["type"] == "answer":
            # Agent decided it has enough info → final answer
            steps.append({
                "step": step_num,
                "type": "thought",
                "content": parsed.get("thought", "Generating final answer."),
            })
            return {
                "answer": parsed["answer"],
                "tools_used": list(set(tools_used)),
                "sources": all_sources,
                "reasoning_steps": steps,
                "user_role": user_role,
            }

        if parsed["type"] == "action":
            tool_name = parsed["tool"]
            tool_input = parsed["input"]

            # Record the thought
            steps.append({
                "step": step_num,
                "type": "thought",
                "content": parsed.get("thought", f"I need to use {tool_name}."),
            })

            # RBAC enforcement: verify the tool is actually available
            if tool_name not in available_tools:
                observation = f"ACCESS DENIED: Tool '{tool_name}' requires a higher role than '{user_role}'."
                steps.append({"step": step_num, "type": "observation", "content": observation, "tool": tool_name})
                messages.append({"role": "user", "content": f"Observation: {observation}"})
                continue

            # Execute the tool
            tool_fn = available_tools[tool_name]["function"]
            try:
                if tool_name == "database_query":
                    results = tool_fn(tool_input)
                else:
                    results = tool_fn(tool_input)
            except Exception as e:
                results = [{"error": str(e), "tool": tool_name}]

            tools_used.append(tool_name)

            # Format observation for the LLM
            observation = _format_observation(results)
            all_sources.extend([
                {
                    "content": r.get("content", "")[:200],
                    "source": r.get("source", "unknown"),
                    "tool": r.get("tool", tool_name),
                    "access_level": r.get("access_level", "unknown"),
                }
                for r in results if "error" not in r
            ])

            steps.append({
                "step": step_num,
                "type": "observation",
                "content": observation[:500],
                "tool": tool_name,
                "result_count": len([r for r in results if "error" not in r]),
            })

            # Feed observation back into the loop
            messages.append({"role": "user", "content": f"Observation from {tool_name}:\n{observation}"})

        else:
            # Unparseable output — treat as a thought and continue
            steps.append({"step": step_num, "type": "thought", "content": llm_output[:300]})

    # Hit max steps — generate final answer from what we have
    final = _generate_final_answer(client, messages, query)
    steps.append({"step": len(steps) + 1, "type": "thought", "content": "Reached max reasoning steps, producing final answer."})

    return {
        "answer": final,
        "tools_used": list(set(tools_used)),
        "sources": all_sources,
        "reasoning_steps": steps,
        "user_role": user_role,
    }


def _build_system_prompt(username: str, user_role: str, tool_descriptions: str) -> str:
    return f"""You are a ReAct research assistant for {username} (role: {user_role}).

You follow the THINK → ACT → OBSERVE loop to answer questions.

## Your Tools
{tool_descriptions}

## Response Format

On each turn, respond in EXACTLY one of these two formats:

### Format A: When you need to use a tool
```
Thought: <your reasoning about what info you need and why>
Action: <tool_name>
Input: <the query or SQL to pass to the tool>
```

### Format B: When you have enough info to answer
```
Thought: <your reasoning about why you have enough info>
Answer: <your final answer to the user's question>
```

## Rules
- Use tools ONE AT A TIME. After each tool call you'll see the results.
- You may call up to {MAX_STEPS} tools total before you must give a final answer.
- Base your answer ONLY on tool results, not your own knowledge.
- If a tool returns no useful results, try a different tool or rephrase.
- If you truly cannot find the answer, say so honestly.
- For database_query: write a valid SQLite SELECT query as the Input.
- NEVER fabricate tool results. NEVER hallucinate sources."""


def _format_tool_descriptions(tools: dict) -> str:
    lines = []
    for name, info in tools.items():
        lines.append(f"- **{name}**: {info['description']}")
    return "\n".join(lines) if lines else "No tools available."


def _parse_react_output(text: str) -> dict:
    """Parse LLM output into structured thought/action/answer."""
    lines = text.strip().split("\n")

    thought = ""
    tool = ""
    tool_input = ""
    answer = ""

    for line in lines:
        stripped = line.strip()
        if stripped.lower().startswith("thought:"):
            thought = stripped[len("thought:"):].strip()
        elif stripped.lower().startswith("action:"):
            tool = stripped[len("action:"):].strip()
        elif stripped.lower().startswith("input:"):
            tool_input = stripped[len("input:"):].strip()
        elif stripped.lower().startswith("answer:"):
            answer = stripped[len("answer:"):].strip()
            # Capture multi-line answers
            idx = lines.index(line)
            if idx + 1 < len(lines):
                remaining = "\n".join(lines[idx + 1:]).strip()
                if remaining:
                    answer += "\n" + remaining
            break

    if answer:
        return {"type": "answer", "thought": thought, "answer": answer}
    elif tool:
        return {"type": "action", "thought": thought, "tool": tool, "input": tool_input or thought}
    else:
        return {"type": "unknown", "content": text}


def _format_observation(results: list[dict]) -> str:
    """Format tool results into a readable observation string."""
    if not results:
        return "No results found."

    parts = []
    for r in results:
        if "error" in r:
            parts.append(f"[ERROR]: {r['error']}")
        else:
            source = r.get("source", "unknown")
            content = r.get("content", "")
            parts.append(f"[{source}]: {content}")

    return "\n".join(parts)


def _generate_final_answer(client: OpenAI, messages: list[dict], query: str) -> str:
    """Force a final answer when max steps reached."""
    messages.append({
        "role": "user",
        "content": "You've gathered enough information. Now provide your final Answer: to the original question. Synthesize everything you've observed.",
    })
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.3,
            max_tokens=500,
        )
        text = response.choices[0].message.content.strip()
        parsed = _parse_react_output(text)
        return parsed.get("answer", text)
    except Exception as e:
        return f"Error generating final answer: {e}"


def _fallback_agent(query: str, available_tools: dict, user_role: str) -> dict:
    """No-LLM fallback: run all available tools and return raw results."""
    all_results = []
    tools_used = []
    steps = [{"step": 1, "type": "thought", "content": "No LLM API key set. Running all available tools as fallback."}]

    for name, info in available_tools.items():
        tool_fn = info["function"]
        try:
            if name == "database_query":
                results = tool_fn("SELECT id, username, role, created_at FROM users LIMIT 10")
            else:
                results = tool_fn(query)
            all_results.extend(results)
            tools_used.append(name)
            steps.append({"step": len(steps) + 1, "type": "observation", "content": f"{name}: {len(results)} results", "tool": name})
        except Exception as e:
            steps.append({"step": len(steps) + 1, "type": "observation", "content": f"{name}: error - {e}", "tool": name})

    context = "\n".join(r.get("content", "") for r in all_results if "error" not in r)
    sources = [
        {"content": r.get("content", "")[:200], "source": r.get("source", "unknown"),
         "tool": r.get("tool", "unknown"), "access_level": r.get("access_level", "unknown")}
        for r in all_results if "error" not in r
    ]

    return {
        "answer": f"[Fallback mode — no LLM] Results from {tools_used}:\n\n{context}" if context else "No results found.",
        "tools_used": tools_used,
        "sources": sources,
        "reasoning_steps": steps,
        "user_role": user_role,
    }
