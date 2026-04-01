# Learning Resources (Markdown Reference)

These markdown files are **standalone reference docs** for reading in GitHub or your editor. They cover the same auth concepts as the React frontend's 15 chapters, but in a more condensed reference format.

**For the full interactive learning experience** (quizzes, JWT decoder, progress tracking, diagrams), use the React frontend:
```bash
cd frontend && npm install && npm run dev
```

## Files
| # | File | Topic |
|---|------|-------|
| 0 | [Password Hashing](00-password-hashing-and-storage.md) | bcrypt internals, salting, cost factors |
| 1 | [JWT Deep Dive](01-jwt-deep-dive.md) | Token structure, claims, HS256/RS256 |
| 2 | [OAuth 2.0](02-oauth2-explained.md) | Authorization code flow, PKCE, scopes |
| 3 | [API Key Auth](03-api-key-auth.md) | Key generation, hashing, rotation |
| 4 | [Session-Based Auth](04-session-based-auth.md) | Cookies, session stores, CSRF |
| 5 | [RBAC Patterns](05-rbac-patterns.md) | Role hierarchies, permission models |
| 6 | [Auth in RAG Systems](06-auth-in-rag-systems.md) | Tool gating, pre-retrieval filtering |
| 7 | [CORS & Security](07-cors-and-auth-security.md) | CORS headers, token storage, middleware |
