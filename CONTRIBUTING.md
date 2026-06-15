# Contributing to Rarebox

Thanks for your interest in contributing!

Full contributor documentation lives at **[docs.rarebox.io](https://docs.rarebox.io)**:

- [Development Setup](https://docs.rarebox.io/contributing/setup) — clone, install, run locally
- [Code Style](https://docs.rarebox.io/contributing/code-style) — conventions and patterns
- [Agentic Engineering](https://docs.rarebox.io/contributing/agentic-engineering) — how to use the Rarebox engineering agent, specs, evals, smoke tests, and CI gates
- [Pull Request Guidelines](https://docs.rarebox.io/contributing/pull-requests) — what makes a good PR
- [API Rate Limits](https://docs.rarebox.io/contributing/rate-limits) — what to watch for during development

Quick start:

```bash
git clone https://github.com/novaoc/rarebox.git
cd rarebox
npm install
npm run dev
```

Opens at `http://localhost:5173`.

Agentic engineering workflow:

- Start non-trivial work with a short spec from `docs/harness/templates/` before editing code.
- Read `AGENTS.md` for the coding-agent contract and project guardrails.
- Use the Rarebox agent harness if you want a dedicated engineering agent workflow: <https://github.com/novaoc/rarebox-agent-harness>
- Before claiming a code change is done, run the relevant harness checks:

```bash
npm run eval:harness
npm run eval:danger
npm run build
npm run smoke:browser   # required for route, layout, app-shell, or user-flow changes
```
