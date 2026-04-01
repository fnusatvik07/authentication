"""SQLite database for resources with access levels."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "resources.db"


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            access_level TEXT NOT NULL DEFAULT 'public',
            category TEXT,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()

    # Seed sample resources if empty
    count = conn.execute("SELECT COUNT(*) FROM resources").fetchone()[0]
    if count == 0:
        seed_data = [
            ("Company Overview", "We are a tech company focused on AI solutions.", "public", "general"),
            ("Product Catalog", "Our flagship product is an AI-powered search engine.", "public", "general"),
            ("Public API Docs", "Our API supports REST and GraphQL endpoints.", "public", "technical"),
            ("Employee Handbook", "Work hours are 9-5. Remote work allowed 3 days/week.", "user", "hr"),
            ("Team Directory", "Engineering: 50 people. Sales: 30 people. Support: 20 people.", "user", "hr"),
            ("Internal Roadmap", "Q2: Launch vector search. Q3: Add multi-modal support.", "user", "product"),
            ("Code Standards", "Use Python 3.11+. All PRs require 2 reviews.", "user", "technical"),
            ("Security Policies", "All endpoints must use JWT. Rotate secrets quarterly.", "admin", "security"),
            ("Incident Playbook", "Step 1: Identify. Step 2: Contain. Step 3: Remediate.", "admin", "security"),
            ("Infrastructure Costs", "AWS: $50k/mo. GCP: $20k/mo. Total: $70k/mo.", "admin", "finance"),
            ("Admin Credentials Guide", "Production DB credentials are in Vault at /secret/prod/db.", "admin", "security"),
            ("Board Meeting Notes", "Revenue grew 40% YoY. Planning Series C.", "super_admin", "executive"),
            ("Acquisition Targets", "Evaluating 3 companies in the RAG space.", "super_admin", "executive"),
            ("Salary Bands", "Engineering L5: $180-220k. L6: $220-280k. L7: $280-350k.", "super_admin", "hr"),
            ("Investor Relations", "Current runway: 24 months. Burn rate: $2M/mo.", "super_admin", "finance"),
        ]
        conn.executemany(
            "INSERT INTO resources (title, content, access_level, category) VALUES (?, ?, ?, ?)",
            seed_data
        )
        conn.commit()
    conn.close()
