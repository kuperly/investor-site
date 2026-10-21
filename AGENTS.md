# AGENTS.md: start here

This repository holds more than one app. Before changing anything:

1. **Read [docs/apps/README.md](docs/apps/README.md)**: the registry of every app, what each one
   does, how they connect, and which doc to read for your task.
2. **Read the page of the app you're changing** (linked from the registry), then its rules file:
   - Marketing site (repo root): [CLAUDE.md](CLAUDE.md)
   - ValeForge internal app (`deal-analyzer/`): [deal-analyzer/CLAUDE.md](deal-analyzer/CLAUDE.md)

Rules for every app (details in the files above):

- **Docs change in the same commit as the code**, including the registry and the app's page.
- **Business thresholds and formulas change only with Guy/Ben's approval**: propose the change,
  the rationale and the tests first.
- **No fabricated data or claims**, and UNKNOWN is never 0.
- **Secrets stay in the hosting dashboards** (Vercel, Railway), never in code, docs or chat.
- **Apps don't import each other's code or share a database.** A connection between apps is a
  documented contract with a test (registry → "How the apps connect").
- **Adding an app**: follow the registry → "Adding a new app".
