# Contributing to Auth Masterclass

Thank you for considering contributing! This project aims to be the best open-source resource for learning authentication from basics to agentic RAG systems.

## How to Contribute

### Reporting Issues
- Use GitHub Issues for bugs, typos, or suggestions
- Include the chapter/project number and a clear description
- For code bugs, include the error message and steps to reproduce

### Adding Content
- **New chapter**: Create a new `ChapterN.jsx` in `frontend/src/pages/chapters/` following the existing pattern (imports, H/P/Section components, MermaidDiagram, CodeBlock, Quiz)
- **New quiz questions**: Add to `frontend/src/data/quizzes.js`
- **New project**: Create a backend directory + walkthrough JSX + test file

### Code Changes
1. Fork the repo
2. Create a branch: `git checkout -b feature/my-change`
3. Make your changes
4. Run ALL tests: `cd project-1-basic/backend && pytest test_project1.py -v` (repeat for projects 2 and 3)
5. Build the frontend: `cd frontend && npm run build`
6. Create a PR with a clear description

### Writing Style Guide
- **Open with an analogy or story** — every chapter starts with a real-world metaphor
- **Explain WHY before HOW** — motivation first, then implementation
- **Use P component for paragraphs** — consistent typography
- **One MermaidDiagram + one CodeBlock + one ComparisonTable minimum** per chapter
- **Add a quiz** (3-5 questions) in `quizzes.js` for every new chapter

### Running Locally
```bash
# Backend tests
cd project-1-basic/backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt pytest httpx && pytest -v

# Frontend
cd frontend && npm install && npm run dev
```

## Project Structure
```
authentication/
├── learning-resources/     # Markdown reference docs
├── project-1-basic/        # HS256 + lockout (45 tests)
├── project-2-medium/       # RS256 + RBAC + password reset (58 tests)
├── project-3-advanced/     # ReAct RAG + blacklisting (62 tests)
├── frontend/               # React learning site
│   └── src/pages/chapters/ # One file per chapter
└── .github/workflows/      # CI — runs all tests on PR
```
