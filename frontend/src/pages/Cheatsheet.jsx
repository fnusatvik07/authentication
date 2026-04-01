import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { ComparisonTable } from '../components/Diagram'
import Navbar from '../components/Navbar'

export default function Cheatsheet() {
  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 pt-24 pb-16">
        <h1 className="text-3xl font-bold mb-2">Auth Cheatsheet</h1>
        <p className="text-[var(--color-text-muted)] mb-10">Quick reference for everything covered in the 15 chapters. Bookmark this page.</p>

        <Section title="Authentication Methods">
          <ComparisonTable headers={['Method', 'How it works', 'Stateless?', 'Revocable?', 'Best for']} rows={[
            ['JWT (HS256)', 'Shared secret signs & verifies', 'Yes', 'Hard (need blacklist)', 'Single-server APIs'],
            ['JWT (RS256)', 'Private key signs, public key verifies', 'Yes', 'Hard (need blacklist)', 'Microservices'],
            ['Session cookie', 'Server stores session in DB/Redis', 'No', 'Easy (delete session)', 'Server-rendered apps'],
            ['API key', 'Static key sent with each request', 'No (DB lookup)', 'Easy (revoke in DB)', 'Machine-to-machine'],
            ['OAuth 2.0', 'Third-party grants scoped tokens', 'Depends', 'Medium', 'Social login, delegated access'],
          ]} />
        </Section>

        <Section title="HTTP Status Codes for Auth">
          <ComparisonTable headers={['Code', 'Name', 'Meaning', 'When to use']} rows={[
            ['200', 'OK', 'Successful request', 'Login, data fetch'],
            ['201', 'Created', 'Resource created', 'Registration'],
            ['401', 'Unauthorized', 'NOT authenticated', 'Missing/invalid/expired token'],
            ['403', 'Forbidden', 'Authenticated but NOT authorized', 'Role too low'],
            ['423', 'Locked', 'Account locked', 'Too many failed logins'],
          ]} />
        </Section>

        <Section title="HS256 vs RS256">
          <ComparisonTable headers={['', 'HS256', 'RS256']} rows={[
            ['Key type', 'Shared secret', 'Public + private key pair'],
            ['Who can sign', 'Anyone with secret', 'Only private key holder'],
            ['Who can verify', 'Anyone with secret', 'Anyone with public key'],
            ['If server hacked', 'Can forge tokens', 'Can only verify, not forge'],
            ['Best for', 'Single server', 'Microservices'],
            ['Our projects', 'P1 and P3', 'P2'],
          ]} />
        </Section>

        <Section title="Password Hashing">
          <ComparisonTable headers={['Algorithm', 'GPU speed', 'Safe for passwords?', 'Why']} rows={[
            ['SHA-256', '10 billion/sec', 'NEVER', 'Way too fast to brute-force'],
            ['MD5', '25 billion/sec', 'NEVER', 'Even faster, also collision-prone'],
            ['bcrypt (cost=12)', '~5,000/sec', 'YES', 'Intentionally slow, built-in salt'],
            ['Argon2id', '~1,000/sec', 'YES', 'Memory-hard, modern best practice'],
          ]} />
        </Section>

        <Section title="Token Comparison">
          <ComparisonTable headers={['', 'Access Token', 'Refresh Token', 'Password Reset Token']} rows={[
            ['Lifetime', '15-60 min', '7-30 days', '1 hour'],
            ['Storage', 'JS memory', 'HTTP-only cookie / DB', 'DB (hashed)'],
            ['Format', 'JWT', 'Random string', 'Random string'],
            ['Revocable', 'Via JTI blacklist', 'Delete from DB', 'Mark as used'],
            ['Sent with', 'Every API request', 'Only /refresh', 'Only /reset/confirm'],
          ]} />
        </Section>

        <Section title="RBAC Role Hierarchy">
          <ComparisonTable headers={['Role', 'Level', 'Can access', 'Tools (P3)']} rows={[
            ['guest', '0', 'Public docs only', 'public_search'],
            ['user', '1', '+ Internal docs', '+ internal_search'],
            ['admin', '2', '+ Admin docs, user management', '+ admin_search'],
            ['super_admin', '3', '+ Everything, role changes, DB access', '+ database_query'],
          ]} />
        </Section>

        <Section title="Security Features by Project">
          <ComparisonTable headers={['Feature', 'P1 Basic', 'P2 Medium', 'P3 Advanced']} rows={[
            ['bcrypt hashing', '✅', '✅', '✅'],
            ['JWT signing', 'HS256', 'RS256', 'HS256'],
            ['Account lockout', '✅', '✅', '✅'],
            ['Refresh tokens', '-', '✅ (rotation)', '✅ (rotation)'],
            ['Password reset', '-', '✅', '-'],
            ['Token blacklisting', '-', '-', '✅ (JTI)'],
            ['RBAC', '-', '✅', '✅'],
            ['Audit logging', '-', '-', '✅'],
            ['ReAct agent', '-', '-', '✅'],
            ['Tests', '45', '58', '62'],
          ]} />
        </Section>

        <div className="mt-12 text-center">
          <Link to="/learn" className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-xl hover:bg-[var(--color-primary-light)] transition-colors">
            <BookOpen size={18} /> Start Learning
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-3 text-[var(--color-text)]">{title}</h2>
      {children}
    </section>
  )
}
