import CodeBlock from '../../components/CodeBlock'
import { InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import { Database } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter13() {
  return (<>
    <H icon={Database} title="Authenticated RAG Systems" badge="Chapter 13 · Advanced" color="purple" />

    <P>You build a helpful AI chatbot for your company. It can search all company documents and answer questions in plain English. Everyone loves it. Day one, an intern asks "What are the executive salary bands?" and the bot happily answers — because it searched the HR database that the intern should never have accessed. The LLM doesn't understand access control. It retrieved the document, found the answer, and presented it. From the model's perspective, it did a great job.</P>

    <P>This is the fundamental problem with Retrieval-Augmented Generation (RAG): <strong>LLMs treat all context equally</strong>. A language model has no concept of "this user is allowed to see this document but not that one." It doesn't understand organizational hierarchies, security clearances, or data classification levels. If a document appears in its context window, the model will use it. Period.</P>

    <P>This means that if you connect an LLM to a knowledge base without thinking about access control, you've effectively given every user in your organization read access to every document. The CEO's strategic memos, the HR compensation data, the legal team's confidential merger plans — all of it is one clever question away from being summarized and handed to anyone with a login.</P>

    <P>The solution isn't to tell the model "don't share confidential information." Prompt instructions can be jailbroken, confused, or simply ignored. The solution is architectural: you must filter documents <strong>before</strong> the LLM ever sees them. By the time the model receives its context, every document in that context should be one the user is authorized to read.</P>

    <Section title="Three Approaches to RAG Access Control">
      <P>There are three places you can enforce access control in a RAG pipeline, and each comes with real trade-offs. Understanding all three helps you pick the right one for your system — or combine them.</P>

      <P><strong>Pre-retrieval filtering</strong> is what we use in Project 3. Before the vector database even runs a similarity search, we restrict which documents are searchable. If you're a "user" role, the query only searches documents tagged as "guest" or "user" level. Admin-only documents don't exist as far as your search is concerned. This is the safest approach because unauthorized documents never enter the pipeline at all. The downside is that you need every document tagged with an access level at indexing time, and your filtering logic runs on every single query.</P>

      <P><strong>Post-retrieval filtering</strong> takes the opposite approach. The vector database searches everything, returns the most relevant results, and then a filter removes any documents the user shouldn't see. This is simpler to implement — you don't need to modify your vector search — but it has a dangerous failure mode: if your filter has a bug, confidential documents flow straight into the LLM's context. It also wastes compute, because you're embedding and searching documents you'll throw away. And there's a subtler issue: if you ask for the top 4 results and 3 are filtered out, you're left with only 1 relevant document, which degrades answer quality.</P>

      <P><strong>Metadata filtering at the database level</strong> lets the vector database itself enforce access rules. Pinecone has namespaces, Weaviate has multi-tenancy, and ChromaDB supports metadata filters in the query. This pushes the security boundary down into the storage layer, which is excellent for defense in depth. But it's vendor-specific, and not every vector database supports it well.</P>

      <ComparisonTable headers={['Strategy', 'How it works', 'Pros', 'Cons']} rows={[
        ['Pre-retrieval filtering', 'Restrict which docs are searchable before the query runs', 'Safest — unauthorized docs never enter the pipeline', 'Need access tags on every document; filter logic on every query'],
        ['Post-retrieval filtering', 'Search everything, then remove unauthorized results', 'Simple to add to existing systems', 'Unsafe if filter has bugs; wastes compute; degrades result quality'],
        ['DB-level metadata filtering', 'Vector DB enforces access rules natively (namespaces, tenancy)', 'DB-enforced, hard to bypass from application code', 'Vendor-specific; not all vector DBs support it well'],
        ['Hybrid (our approach)', 'Pre-retrieval filtering + execution-layer tool gating', 'Defense in depth; multiple barriers', 'Most complex to implement and reason about'],
      ]} />
    </Section>

    <Section title="How Our Pipeline Works">
      <P>In Project 3, when a user sends a question to the RAG agent, the first thing that happens is not a vector search — it's a JWT verification. We extract the user's role from their token, and that role determines which documents the vector search can even consider. Let's trace the full flow:</P>

      <MermaidDiagram title="Access-controlled RAG pipeline — filtering happens BEFORE the LLM" chart={`sequenceDiagram
    participant U as 👤 User (role: user)
    participant API as 🖥️ API Server
    participant VDB as 📚 Vector DB
    participant LLM as 🤖 LLM

    U->>API: "Summarize Q3 strategy"<br/>Authorization: Bearer eyJ...
    Note over API: Verify JWT ✓<br/>Extract role: "user"

    API->>VDB: Similarity search: "Q3 strategy"<br/>WHERE access_level <= "user"
    Note over VDB: Filter BEFORE similarity search<br/>Exclude admin-only & executive docs
    VDB-->>API: [doc1: "Q3 product roadmap",<br/>doc2: "Q3 marketing plan"]<br/>(executive docs filtered out)

    API->>LLM: System: "Answer based on context only"<br/>Context: [doc1, doc2]<br/>Question: "Summarize Q3 strategy"
    Note over LLM: Can only see user-level docs<br/>Cannot access executive strategy
    LLM-->>API: "Based on the available documents..."
    API-->>U: Generated summary (from authorized docs only)`} />

      <P>Notice what happened: the user asked about "Q3 strategy," and there might be an executive-level strategy document that would perfectly answer the question. But because the user has "user" role, that document was excluded from the similarity search entirely. The LLM never saw it. It can't leak what it never received. The model generated its answer from only the two user-level documents, and if those don't contain enough information, it says so honestly rather than pulling from restricted sources.</P>
    </Section>

    <Section title="Implementing Access-Controlled Retrieval">
      <P>The retrieval function is where the access control actually lives. Each document in our vector store was tagged with an <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">access_level</code> metadata field when it was indexed. At query time, we compare the user's role level against each document's required level. Only documents at or below the user's clearance make it through.</P>

      <CodeBlock title="rag.py — Role-aware document retrieval" language="python" code={`from langchain.vectorstores import FAISS

ROLE_HIERARCHY = {"guest": 0, "user": 1, "admin": 2, "super_admin": 3}

def retrieve_documents(query: str, user_role: str, k: int = 4):
    """Retrieve documents the user is authorized to see.

    Each document in the vector store has metadata:
    {"content": "...", "access_level": "user", "source": "..."}

    We only return documents where the user's role level
    is >= the document's required access level.
    """
    user_level = ROLE_HIERARCHY.get(user_role, 0)

    # Retrieve more candidates than needed, then filter
    candidates = vectorstore.similarity_search(query, k=k * 3)

    # Filter by access level
    authorized = [
        doc for doc in candidates
        if ROLE_HIERARCHY.get(doc.metadata.get("access_level", "admin"), 3) <= user_level
    ]

    return authorized[:k]  # Return top-k authorized results

def rag_query(question: str, user: dict) -> str:
    """Full RAG pipeline with access control."""
    # Step 1: Retrieve (filtered by role)
    docs = retrieve_documents(question, user["role"])

    if not docs:
        return "No authorized documents found for your query."

    # Step 2: Build context from authorized docs only
    context = "\\n\\n".join([doc.page_content for doc in docs])

    # Step 3: Generate (LLM only sees authorized content)
    prompt = f"""Answer based ONLY on the following context.
If the context doesn't contain the answer, say so.

Context:
{context}

Question: {question}"""

    response = llm.invoke(prompt)
    return response.content`} />

      <P>There's a subtle but important detail in this code: the default access level is "admin" (<code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">doc.metadata.get("access_level", "admin")</code>). This means if a document somehow gets indexed without an access tag, it defaults to the most restrictive level. Fail closed, not open. A missing tag means "only admins can see this," not "everyone can see this." This is a security principle you should apply everywhere: when in doubt, deny access.</P>

      <InfoBox type="danger" title="The LLM cannot enforce access control">
        Never rely on a system prompt like "Don't share admin documents with regular users." LLMs can be jailbroken, confused, or simply make mistakes. Prompt injection attacks can override system instructions entirely. The <strong>only</strong> reliable access control is to never give the LLM unauthorized documents in the first place. Filter at the retrieval layer, not the generation layer.
      </InfoBox>
    </Section>

    <Section title="Tool Registry with Minimum Roles">
      <P>Document access is only half the story. Project 3's agent can also call tools — functions that search databases, run analytics, or modify system settings. Each tool has a minimum role requirement, and the registry maps tool names to their access levels. When a user starts an agent session, we build the tool list for the LLM's system prompt by checking each tool against the user's role. If a tool requires "admin" and the user is "user," that tool simply doesn't appear in the prompt. The LLM doesn't know it exists.</P>

      <CodeBlock title="tools.py — Role-gated tool registry" language="python" code={`TOOL_REGISTRY = {
    "search_docs": {
        "description": "Search the knowledge base for relevant documents",
        "min_role": "guest",
        "function": search_docs,
    },
    "get_user_profile": {
        "description": "Look up a user's profile information",
        "min_role": "user",
        "function": get_user_profile,
    },
    "run_analytics": {
        "description": "Execute analytics queries on usage data",
        "min_role": "admin",
        "function": run_analytics,
    },
    "manage_system": {
        "description": "Modify system configuration and settings",
        "min_role": "super_admin",
        "function": manage_system,
    },
}

def get_available_tools(user_role: str) -> list:
    """Return tool descriptions for tools the user can access.

    These descriptions become part of the LLM's system prompt.
    The LLM literally cannot call tools it doesn't know about.
    """
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    available = []
    for name, tool in TOOL_REGISTRY.items():
        if ROLE_HIERARCHY[tool["min_role"]] <= user_level:
            available.append(f"- {name}: {tool['description']}")
    return available`} />

      <P>Think of this like a building with locked doors. Pre-retrieval filtering controls which filing cabinets you can open. Tool gating controls which rooms you can enter. Together, they create a layered defense: even if one mechanism fails, the other still protects your system. A guest can search public documents but can't run analytics. An admin can do both but can't modify system settings. Each role sees exactly the capabilities appropriate to their trust level — no more, no less.</P>

      <InfoBox type="tip" title="Defense in depth for AI systems">
        This is the same "defense in depth" principle that traditional security has used for decades, applied to a new domain. Don't rely on a single barrier. The tool registry filters what the LLM sees, and the execution layer double-checks before running anything. We'll explore that double enforcement in detail in the next chapter.
      </InfoBox>
    </Section>
  </>)
}
