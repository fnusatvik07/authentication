import CodeBlock from '../../components/CodeBlock'
import { InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import { Lock } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter3() {
  return (<>
    <H icon={Lock} title="Environment Variables & Secrets" badge="Chapter 3 · Foundation" color="green" />

    <P>Here's a story that happens more often than you'd think: a developer pushes their code to GitHub. Buried in that code is a line like <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">SECRET_KEY = "a1b2c3..."</code>. Within minutes — literally minutes — bots that scan every public GitHub commit find that key and start using it. If it's an AWS key, the developer wakes up to a $50,000 bill from crypto miners.</P>

    <P>This isn't hypothetical. It happens every day. The rule is absolute: <strong>never put secrets in your code</strong>. Not in Python files, not in JavaScript, not in config files that get committed. Secrets go in <strong>environment variables</strong>.</P>

    <Section title="What Are Environment Variables?">
      <P>Environment variables are key-value pairs that exist outside your code, in the operating system's environment. Your code reads them at runtime. If someone reads your source code, they see <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">os.getenv("SECRET_KEY")</code> — not the actual secret.</P>

      <MermaidDiagram title="Where secrets live at each stage" chart={`flowchart LR
    A["📄 .env file<br/>(local development)<br/>SECRET_KEY=abc123"] --> B["🔧 os.environ<br/>(runtime memory)"]
    C["☁️ Cloud Secrets Manager<br/>(production)<br/>AWS/GCP/Vault"] --> B
    B --> D["🖥️ Your Application<br/>os.getenv('SECRET_KEY')"]
    style A fill:#fffbeb,stroke:#d97706
    style C fill:#ecfdf5,stroke:#059669
    style B fill:#eef2ff,stroke:#6366f1
    style D fill:#f8fafc,stroke:#e2e8f0`} />
    </Section>

    <Section title="The .env File Pattern">
      <P>For local development, we use a <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">.env</code> file. This file sits in your project root but is <strong>never committed to git</strong>. Here's what ours looks like:</P>

      <CodeBlock title=".env — Your local secrets (NEVER commit this)" language="bash" code={`# JWT signing key — generate with:
# python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=a1b2c3d4e5f6789012345678abcdef90abcdef1234567890abcdef1234567890

# OpenAI API key (for Project 3's RAG agent)
OPENAI_API_KEY=sk-proj-...

# Database URL (could also be a connection string)
DATABASE_URL=sqlite:///./auth.db`} />

      <CodeBlock title=".gitignore — Prevents .env from being committed" language="bash" code={`# CRITICAL: Never commit secrets
.env

# Database files (contain user data)
*.db

# Python
__pycache__/
.venv/`} />

      <CodeBlock title="Loading secrets in Python" language="python" code={`import os
from dotenv import load_dotenv

# Reads .env file into os.environ
load_dotenv()

# Now use environment variables
SECRET_KEY = os.getenv("SECRET_KEY")

# Fail loudly if a required secret is missing
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY environment variable not set! "
        "Copy .env.example to .env and fill in your values."
    )`} />
    </Section>

    <Section title="What Secrets Our Projects Need">
      <ComparisonTable headers={['Secret', 'Used In', 'Purpose', 'What happens if leaked']} rows={[
        ['SECRET_KEY', 'All projects', 'Sign JWT tokens', 'Attacker can forge any user\'s token'],
        ['OPENAI_API_KEY', 'Project 3', 'ReAct agent LLM calls', 'Attacker runs up your API bill'],
        ['RSA Private Key', 'Project 2', 'Sign RS256 tokens', 'Attacker can forge tokens'],
        ['RSA Public Key', 'Project 2', 'Verify RS256 tokens', 'Safe to share — cannot forge'],
      ]} />

      <InfoBox type="danger" title="The #1 rule of secrets">
        If you ever accidentally commit a secret to git, <strong>rotating it is the only safe response</strong>. Even if you delete the commit, git history preserves it. GitHub's push protection and secret scanning tools help, but the safest approach is to never let secrets near your code in the first place.
      </InfoBox>
    </Section>
  </>)
}
