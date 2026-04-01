import CodeBlock from '../../components/CodeBlock'
import { InfoBox, ComparisonTable } from '../../components/Diagram'
import MermaidDiagram from '../../components/MermaidDiagram'
import { Cpu } from 'lucide-react'
import { H, P, Section } from './shared'

export default function Chapter15() {
  return (<>
    <H icon={Cpu} title="Production & Operations" badge="Chapter 15 · Advanced" color="purple" />

    <P>You've built all three projects. They work on your laptop. But "works on my laptop" and "works in production" are very different things. On your laptop, you have one user (you). In production, you have thousands of concurrent users. On your laptop, if the server crashes, you restart it. In production, a crash at 3 AM means angry customers and lost revenue. On your laptop, nobody is trying to break in. In production, someone is always trying to break in.</P>

    <P>This chapter is about the gap between what we built and what a production system needs. We're not going to sugarcoat it - our projects cut real corners for the sake of learning. That was the right call: you can't learn JWT mechanics if you're also wrestling with Kubernetes, TLS certificates, and Redis cluster configuration. But now that you understand the fundamentals, let's be honest about what a production deployment would look like.</P>

    <Section title="What We Built at Each Stage">
      <P>Before talking about what's missing, let's appreciate what's there. Each project stacked new security concepts on top of the last, and the progression was deliberate. Project 1 gave you the foundation: registration, password hashing, JWT signing, RBAC, and token refresh. You can't build advanced auth without understanding every one of these. Project 2 added real-world hardening: asymmetric RS256 signing for multi-service architectures, account lockout to slow brute-force attacks, token blacklisting for immediate revocation, and password reset flows. Project 3 brought authentication into the AI domain: gating RAG retrieval by role, restricting agent tools by permission level, and the double enforcement pattern that makes LLM-powered systems safe to deploy.</P>

      <MermaidDiagram title="Security features across our three projects" chart={`flowchart LR
    subgraph P1["Project 1: JWT Basics"]
        A1["✅ User registration"]
        A2["✅ Password hashing (bcrypt)"]
        A3["✅ HS256 JWT tokens"]
        A4["✅ Role-based access (RBAC)"]
        A5["✅ Token refresh"]
    end

    subgraph P2["Project 2: Advanced Auth"]
        B1["✅ RS256 asymmetric JWT"]
        B2["✅ Account lockout"]
        B3["✅ Token blacklisting (JTI)"]
        B4["✅ Password reset flow"]
        B5["✅ Public key distribution"]
    end

    subgraph P3["Project 3: AI Agent Auth"]
        C1["✅ Authenticated RAG"]
        C2["✅ Tool gating by role"]
        C3["✅ ReAct agent loop"]
        C4["✅ Double enforcement"]
        C5["✅ Pre-retrieval filtering"]
    end

    P1 --> P2 --> P3

    style P1 fill:#eef2ff,stroke:#6366f1
    style P2 fill:#fffbeb,stroke:#d97706
    style P3 fill:#f5f3ff,stroke:#7c3aed`} />

      <P>The architecture across all three projects is sound. The patterns - dependency injection for auth guards, role hierarchies, token rotation, pre-retrieval filtering - are the same patterns used at companies running production AI systems. What changes in production is the infrastructure underneath those patterns, not the patterns themselves.</P>
    </Section>

    <Section title="Honest Assessment: What Production Would Add">
      <P>Let's walk through each area where our projects took a shortcut and explain what production demands instead. This isn't a criticism of our projects - it's a roadmap for what comes next.</P>

      <P><strong>HTTPS everywhere.</strong> Our projects run over plain HTTP. This means every JWT token, every password, every API request travels over the network in plaintext. On localhost, that's fine - the traffic never leaves your machine. In production, this is a catastrophic vulnerability. Anyone on the same network can read the tokens mid-flight (a man-in-the-middle attack). Production requires TLS on every endpoint, enforced by an HSTS header that tells browsers "never connect to this domain over HTTP, ever." Let's Encrypt makes certificates free. There is no excuse for running auth without HTTPS in production.</P>

      <P><strong>Token blacklist storage.</strong> Our blacklist is a Python set in memory. It works perfectly for learning - but the moment you restart the server, every blacklisted token is un-blacklisted. In production, you'd use Redis with a TTL (time-to-live) matching the token's expiration. Redis persists across restarts, shares state across multiple server instances, and automatically cleans up expired entries. The code change is small - swap the set for a Redis call - but the operational difference is enormous.</P>

      <P><strong>Rate limiting.</strong> Our projects have account lockout (5 failed login attempts), but no rate limiting on other endpoints. An attacker could flood <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">/api/register</code> with millions of requests, creating fake accounts or simply overwhelming the server. Production needs per-IP and per-user rate limits on every endpoint: 10 login attempts per minute per IP, 3 registration attempts per hour per IP, and so on. Tools like Redis-backed rate limiters or API gateways (nginx, Cloudflare) handle this.</P>

      <P><strong>Database.</strong> SQLite is a single file on disk. It handles one write at a time. For a learning project, that's perfect - zero configuration, zero dependencies. But production auth systems handle thousands of concurrent logins. PostgreSQL or MySQL with connection pooling, replication for high availability, and automated backups is the standard. The ORM code stays the same; you just change the connection string.</P>

      <P><strong>Secret management.</strong> Our <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">.env</code> file works for local development, but in production, secrets should live in a dedicated secrets manager - AWS Secrets Manager, HashiCorp Vault, or GCP Secret Manager. These systems provide audit logs (who accessed which secret and when), automatic rotation (change the JWT signing key every 90 days without downtime), and access control (only the auth service can read the signing key).</P>

      <P><strong>CORS policy.</strong> Our projects allow requests from <code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">localhost:3000</code>. In production, you'd have a strict whitelist of allowed origins - your actual frontend domain and nothing else. A wildcard (<code className="bg-[var(--color-surface2)] px-1 rounded text-[13px]">*</code>) in production CORS means any website in the world can make authenticated requests to your API from a user's browser.</P>

      <ComparisonTable headers={['Feature', 'Our Projects', 'Production System', 'Why It Matters']} rows={[
        ['Token blacklist', 'In-memory Python set', 'Redis with TTL', 'Memory resets on restart; Redis persists and shares across servers'],
        ['Database', 'SQLite file', 'PostgreSQL / MySQL', 'SQLite doesn\'t handle concurrent writes; no replication or backups'],
        ['Password hashing', 'bcrypt (cost=12)', 'Argon2id (memory-hard)', 'Argon2id resists GPU attacks better; OWASP current recommendation'],
        ['Secret storage', '.env file', 'AWS Secrets Manager / Vault', '.env files can be accidentally committed; managed secrets auto-rotate'],
        ['HTTPS', 'Not configured (HTTP)', 'TLS everywhere', 'Tokens sent over HTTP can be intercepted (man-in-the-middle)'],
        ['Rate limiting', 'Account lockout only', 'Per-IP + per-user rate limits', 'Without it, attackers can flood registration or consume resources'],
        ['Logging', 'Print statements', 'Structured logging + SIEM', 'Need audit trail for security incidents and compliance'],
        ['Key rotation', 'Static keys', 'Periodic key rotation', 'If a key is compromised, rotation limits the blast radius'],
        ['CORS', 'Allow localhost', 'Strict origin whitelist', 'Overly permissive CORS allows cross-site attacks'],
        ['Input validation', 'Pydantic basics', '+ Password strength, email verification', 'Weak passwords and unverified emails create account takeover risk'],
      ]} />
    </Section>

    <Section title="The Production Checklist, Walked Through">
      <P>Rather than just listing checkboxes, let's walk through the most critical items and explain when each one matters. Not everything needs to happen on day one - but you should know the priority order.</P>

      <P><strong>Day one priorities</strong> - these are non-negotiable before any real user touches your system. HTTPS with a valid TLS certificate. A real database (PostgreSQL) instead of SQLite. Rate limiting on login and registration endpoints. Secrets in environment variables or a secrets manager, never in code. These four changes take your project from "demo" to "safe enough to launch."</P>

      <P><strong>Week one additions</strong> - after launch, add these quickly. Move the token blacklist to Redis so it survives restarts and works across multiple server instances. Add structured logging (JSON format) for every authentication event: login, logout, failed attempt, role change, token refresh. Set up monitoring alerts for suspicious patterns: 50 failed logins from one IP, sudden spike in token errors, or login attempts for nonexistent usernames. Tighten your CORS policy to only allow your actual frontend domain.</P>

      <P><strong>Month one hardening</strong> - these are important but can wait until you have users and traffic patterns to observe. Implement key rotation for your JWT signing keys (sign with the new key, verify with both old and new during the transition window). Upgrade from bcrypt to Argon2id for password hashing. Add email verification for new accounts. Implement password strength requirements on the server side (not just the frontend). Set up a SIEM (Security Information and Event Management) system to aggregate and analyze your auth logs.</P>

      <CodeBlock title="production_checklist.py - Verify your deployment" language="python" code={`"""
Production Auth System Checklist
================================

TRANSPORT SECURITY
[x] HTTPS/TLS on all endpoints (use Let's Encrypt or cloud provider)
[x] HSTS header: Strict-Transport-Security: max-age=31536000
[x] Secure cookie flags: HttpOnly, Secure, SameSite=Strict

TOKEN SECURITY
[x] Access token lifetime <= 15 minutes
[x] Refresh token rotation enabled (single-use)
[x] JTI blacklist backed by Redis (not in-memory)
[x] RS256 for multi-service architectures
[x] Token type validation (access vs refresh)

PASSWORD SECURITY
[x] bcrypt cost >= 12 (or Argon2id)
[x] Password strength requirements enforced server-side
[x] Account lockout after 5 failed attempts
[x] Anti-enumeration on login AND forgot-password

KEY MANAGEMENT
[x] Secrets in environment variables or secrets manager (never in code)
[x] RSA private key access restricted to auth server only
[x] Key rotation plan documented and tested

INFRASTRUCTURE
[x] Rate limiting: 10 login attempts/minute per IP
[x] CORS: strict origin whitelist (no wildcards in production)
[x] Database: PostgreSQL with connection pooling
[x] Structured logging with audit trail for all auth events
[x] Monitoring alerts for: lockout spikes, token error spikes, unusual IPs

API SECURITY
[x] Input validation on all endpoints (Pydantic models)
[x] No sensitive data in JWT payload (no passwords, no PII)
[x] Generic error messages (no username/email enumeration)
[x] Response headers: X-Content-Type-Options, X-Frame-Options
"""`} />

      <InfoBox type="tip" title="You don't need everything on day one">
        This checklist can feel overwhelming. The practical approach: start with what we built (it covers the fundamentals correctly), then add production hardening incrementally. HTTPS, Redis-backed blacklist, and rate limiting are the highest-priority additions. Key rotation and SIEM integration can come later. Ship, learn, harden, repeat.
      </InfoBox>
    </Section>

    <Section title="What You've Accomplished">
      <P>Take a step back and look at what you've built across this entire curriculum. You started at Chapter 1, where HTTP was a restaurant waiter carrying messages back and forth. Now you understand the full stack of modern authentication - from password hashing internals to JWT signature verification, from RBAC hierarchies to AI agent tool gating, from single-server HS256 to multi-service RS256 architectures.</P>

      <P><strong>Project 1</strong> gave you the foundation: user registration, bcrypt password hashing, HS256 JWT tokens, role-based access control, and token refresh. Every authentication system in the world builds on these primitives, and now you understand each one at the code level.</P>

      <P><strong>Project 2</strong> added real-world hardening: asymmetric RS256 signing so microservices can verify tokens without sharing the signing key, account lockout to throttle brute-force attacks, JTI-based token blacklisting for instant revocation, and password reset flows. These are the features that separate a tutorial project from a system you could actually deploy.</P>

      <P><strong>Project 3</strong> took everything into new territory: authenticated RAG with pre-retrieval access filtering, a ReAct agent that reasons in a loop, tool gating that hides capabilities from unauthorized users, and double enforcement that catches LLM hallucinations. Authentication applied to AI systems is a skill very few developers have right now, and you've built it from scratch.</P>

      <P>The difference between what you built and what ships at a company is infrastructure - Redis instead of in-memory sets, PostgreSQL instead of SQLite, TLS certificates instead of plain HTTP. The architecture is the same. The patterns are the same. The security thinking is the same. You've learned the hard part. The infrastructure is just configuration.</P>
    </Section>

    <Section title="Where to Go Next">
      <P>Authentication is a deep field, and 15 chapters can only cover so much. Here are the areas worth exploring once you're comfortable with what we've built, in rough order of practical value:</P>

      <P><strong>OAuth2 and OpenID Connect.</strong> We built our own auth server, which is the best way to learn. But in production, you'll often delegate authentication to providers like Auth0, Okta, or Clerk. Understanding OAuth2 flows (authorization code, PKCE) and OIDC (the identity layer on top of OAuth2) is essential for integrating with these services. The JWT knowledge you've built here transfers directly - OIDC tokens are JWTs.</P>

      <P><strong>Mutual TLS (mTLS).</strong> In our projects, only the server proves its identity (via TLS certificate). In zero-trust architectures, both sides prove identity - the client presents a certificate too. This is increasingly common in service-to-service communication within microservice architectures. Istio and Linkerd implement this at the service mesh level.</P>

      <P><strong>Zero-trust architecture.</strong> The traditional model is "trust everything inside the network perimeter." Zero-trust says "trust nothing, verify everything." Every request is authenticated and authorized, even between internal services. Google's BeyondCorp paper is the seminal work here, and it builds directly on the JWT and RBAC patterns you've learned.</P>

      <P><strong>WebAuthn and passkeys.</strong> Passwords are the weakest link in authentication - they can be phished, reused, and brute-forced. WebAuthn replaces passwords with cryptographic key pairs tied to the user's device. Apple, Google, and Microsoft are pushing passkeys as the successor to passwords. Understanding the public-key cryptography from our RS256 chapters gives you the foundation to learn WebAuthn.</P>

      <P><strong>Audit logging and compliance.</strong> SOC 2, HIPAA, GDPR - these compliance frameworks have specific requirements for authentication logging, data retention, and access control. If you work at a company that handles sensitive data, understanding how your auth system maps to compliance requirements is a valuable skill that's rarely taught in engineering courses.</P>

      <InfoBox type="info" title="Ready to build">
        Head to the <strong>Projects</strong> section to put everything into practice. Each project builds on the concepts from these chapters, with hands-on code you can run, test, and extend. The best way to internalize authentication is to build it yourself. You've read the theory - now go write the code.
      </InfoBox>
    </Section>
  </>)
}
