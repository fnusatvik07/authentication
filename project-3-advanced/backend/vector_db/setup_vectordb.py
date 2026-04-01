"""Vector database setup: FAISS for public docs, ChromaDB for role-gated docs.

Run this script to initialize and populate the vector databases with sample documents.
"""

import os
import sys
import numpy as np

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import chromadb
import faiss
import json
from pathlib import Path

VECTOR_DIR = Path(__file__).parent
FAISS_INDEX_PATH = VECTOR_DIR / "faiss_public.index"
FAISS_DOCS_PATH = VECTOR_DIR / "faiss_public_docs.json"
CHROMA_DIR = VECTOR_DIR / "chroma_data"

# ──────────────────────────────────────────────────────
# Sample documents organized by access level
# ──────────────────────────────────────────────────────

PUBLIC_DOCS = [
    {"content": "Our company provides AI-powered search solutions for enterprises. Founded in 2020, we serve over 500 clients globally.", "metadata": {"source": "company_overview", "category": "general"}},
    {"content": "Our main product is SearchAI, a semantic search engine that uses vector embeddings to find relevant documents. It supports 20+ languages.", "metadata": {"source": "product_info", "category": "product"}},
    {"content": "Getting started with our API: Register at api.example.com, get your API key, and make your first request using POST /v1/search with your query.", "metadata": {"source": "api_docs", "category": "technical"}},
    {"content": "Pricing: Free tier includes 1000 queries/month. Pro tier at $99/month includes 50,000 queries. Enterprise pricing is custom.", "metadata": {"source": "pricing", "category": "business"}},
    {"content": "Our vector search technology uses transformer-based embeddings with HNSW indexing for sub-millisecond retrieval on billions of documents.", "metadata": {"source": "tech_blog", "category": "technical"}},
    {"content": "Customer success story: Acme Corp reduced their support ticket resolution time by 60% using our AI search solution.", "metadata": {"source": "case_study", "category": "business"}},
    {"content": "FAQ: What file formats do you support? We support PDF, DOCX, TXT, HTML, and Markdown. Maximum file size is 50MB.", "metadata": {"source": "faq", "category": "support"}},
    {"content": "Our platform is SOC 2 Type II certified and GDPR compliant. Data is encrypted at rest (AES-256) and in transit (TLS 1.3).", "metadata": {"source": "security_overview", "category": "security"}},
]

INTERNAL_DOCS = [
    {"content": "Engineering team standup is at 10am PST daily. Sprint planning every Monday. Retrospective every other Friday.", "metadata": {"source": "team_handbook", "category": "process"}},
    {"content": "Internal API rate limits: 10,000 requests/minute for production services, 1,000/minute for staging. Contact platform team for increases.", "metadata": {"source": "internal_api_guide", "category": "technical"}},
    {"content": "Code review policy: All PRs require 2 approvals. Security-sensitive changes need security team review. Max PR size: 500 lines.", "metadata": {"source": "dev_guidelines", "category": "process"}},
    {"content": "Q2 Roadmap: 1) Multi-modal search (images + text), 2) Real-time indexing pipeline, 3) Custom embedding model fine-tuning.", "metadata": {"source": "roadmap", "category": "product"}},
    {"content": "On-call rotation: Each team member does 1 week per quarter. Primary on-call handles P0/P1, secondary handles P2. Escalation to engineering manager after 30 min.", "metadata": {"source": "oncall_guide", "category": "operations"}},
    {"content": "Deployment pipeline: Feature branch → PR → Staging (auto-deploy) → QA sign-off → Production (manual promote). Rollback within 5 minutes.", "metadata": {"source": "deployment_guide", "category": "technical"}},
    {"content": "Benefits: Health/dental/vision insurance, 401k with 4% match, $2000/year learning budget, 20 PTO days, remote-first.", "metadata": {"source": "benefits_summary", "category": "hr"}},
    {"content": "Internal tool access: Jira for tickets, Confluence for docs, Slack for comms, GitHub for code, Datadog for monitoring, PagerDuty for alerts.", "metadata": {"source": "tooling_guide", "category": "operations"}},
]

ADMIN_DOCS = [
    {"content": "AWS infrastructure costs: EC2 $25k/mo, S3 $8k/mo, RDS $12k/mo, Lambda $3k/mo, CloudFront $2k/mo. Total: $50k/mo. Budget target: reduce 15% by Q3.", "metadata": {"source": "infra_costs", "category": "finance"}},
    {"content": "Security incident response: 1) Isolate affected systems, 2) Preserve evidence, 3) Notify security team + CTO within 15 min, 4) Begin investigation, 5) Write post-mortem within 48h.", "metadata": {"source": "incident_playbook", "category": "security"}},
    {"content": "Production database credentials are stored in AWS Secrets Manager. Access requires VPN + MFA. Read replicas available at db-read.internal:5432.", "metadata": {"source": "db_credentials_guide", "category": "security"}},
    {"content": "Compliance requirements: Annual penetration testing (next: March 2026). Quarterly access reviews. Monthly vulnerability scanning. SOC 2 audit in June.", "metadata": {"source": "compliance_schedule", "category": "security"}},
    {"content": "Vendor contracts: AWS (3-year commit, $1.5M/yr), Datadog ($120k/yr, renews Sept), GitHub Enterprise ($50k/yr). Total vendor spend: $1.8M/yr.", "metadata": {"source": "vendor_contracts", "category": "finance"}},
    {"content": "Hiring plan Q2: 3 senior backend engineers, 2 ML engineers, 1 security engineer, 1 product manager. Total headcount target: 85 by EOQ.", "metadata": {"source": "hiring_plan", "category": "hr"}},
]

SUPER_ADMIN_DOCS = [
    {"content": "Board meeting notes (March 2026): Revenue $8M ARR (up 45% YoY). Burn rate $600k/mo. Runway: 30 months. Board approved Series B exploration.", "metadata": {"source": "board_notes", "category": "executive"}},
    {"content": "Acquisition target analysis: Company A (RAG startup, $5M valuation, 10 engineers), Company B (embedding model, $12M, 25 engineers). Recommend acquiring A for talent + tech.", "metadata": {"source": "ma_analysis", "category": "executive"}},
    {"content": "Executive compensation: CEO $350k + 5% equity, CTO $300k + 3% equity, VP Eng $280k + 1.5% equity. Option pool: 12% remaining.", "metadata": {"source": "exec_comp", "category": "hr"}},
    {"content": "Investor update draft: Key metrics - 500 customers, 99.9% uptime, NPS 72, CAC $5k, LTV $45k. Preparing for $30M Series B at $150M valuation.", "metadata": {"source": "investor_update", "category": "executive"}},
    {"content": "Legal matters: Patent filing for multi-modal retrieval (filed Feb 2026). NDA with Company B for acquisition talks. Employment lawsuit settled ($50k).", "metadata": {"source": "legal_matters", "category": "legal"}},
]


def get_embeddings(texts: list[str]) -> np.ndarray:
    """Get embeddings using OpenAI API, or fall back to random for demo."""
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            response = client.embeddings.create(input=texts, model="text-embedding-3-small")
            return np.array([e.embedding for e in response.data], dtype=np.float32)
        except Exception as e:
            print(f"OpenAI embedding failed ({e}), using random embeddings for demo")

    # Fallback: deterministic pseudo-random embeddings for demo purposes
    np.random.seed(42)
    return np.random.rand(len(texts), 1536).astype(np.float32)


def setup_faiss_public():
    """Create FAISS index for public documents."""
    print("Setting up FAISS index for public documents...")

    texts = [doc["content"] for doc in PUBLIC_DOCS]
    embeddings = get_embeddings(texts)

    # Build FAISS index
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)

    # Save index
    faiss.write_index(index, str(FAISS_INDEX_PATH))

    # Save document metadata alongside
    docs_with_ids = []
    for i, doc in enumerate(PUBLIC_DOCS):
        docs_with_ids.append({"id": i, "content": doc["content"], "metadata": doc["metadata"]})

    with open(FAISS_DOCS_PATH, "w") as f:
        json.dump(docs_with_ids, f, indent=2)

    print(f"  FAISS index saved: {len(texts)} public documents, dimension={dimension}")


def setup_chroma_collections():
    """Create ChromaDB collections for internal and admin docs."""
    print("Setting up ChromaDB collections...")

    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))

    # Internal docs collection (user+ access)
    try:
        client.delete_collection("internal_docs")
    except Exception:
        pass
    internal_col = client.create_collection("internal_docs", metadata={"access_level": "user"})
    internal_col.add(
        documents=[d["content"] for d in INTERNAL_DOCS],
        metadatas=[d["metadata"] for d in INTERNAL_DOCS],
        ids=[f"internal_{i}" for i in range(len(INTERNAL_DOCS))],
    )
    print(f"  ChromaDB 'internal_docs': {len(INTERNAL_DOCS)} documents")

    # Admin docs collection (admin+ access)
    try:
        client.delete_collection("admin_docs")
    except Exception:
        pass
    admin_col = client.create_collection("admin_docs", metadata={"access_level": "admin"})
    admin_col.add(
        documents=[d["content"] for d in ADMIN_DOCS],
        metadatas=[d["metadata"] for d in ADMIN_DOCS],
        ids=[f"admin_{i}" for i in range(len(ADMIN_DOCS))],
    )
    print(f"  ChromaDB 'admin_docs': {len(ADMIN_DOCS)} documents")

    # Super admin docs collection (super_admin access)
    try:
        client.delete_collection("super_admin_docs")
    except Exception:
        pass
    sa_col = client.create_collection("super_admin_docs", metadata={"access_level": "super_admin"})
    sa_col.add(
        documents=[d["content"] for d in SUPER_ADMIN_DOCS],
        metadatas=[d["metadata"] for d in SUPER_ADMIN_DOCS],
        ids=[f"super_admin_{i}" for i in range(len(SUPER_ADMIN_DOCS))],
    )
    print(f"  ChromaDB 'super_admin_docs': {len(SUPER_ADMIN_DOCS)} documents")


if __name__ == "__main__":
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent.parent / ".env"
    load_dotenv(env_path)

    print("=" * 50)
    print("Setting up Vector Databases")
    print("=" * 50)

    setup_faiss_public()
    setup_chroma_collections()

    print("\nDone! Vector databases are ready.")
    print(f"  FAISS index: {FAISS_INDEX_PATH}")
    print(f"  ChromaDB: {CHROMA_DIR}")
