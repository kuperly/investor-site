# <App or module name>

> Copy this file to `docs/apps/<app-name>.md` for a new app, or to
> `deal-analyzer/docs/modules/<module>.md` for a new module of the internal app.
> Keep every heading. Write "None" rather than deleting a section. Then add the app
> to the registry: [README.md](README.md) → "Adding a new app".

**In one sentence:** what it does and for whom.

| | |
|---|---|
| Status | e.g. live / internal testing / in development |
| Users | who uses it, and whether they sign in |
| Code | folder(s) |
| URL / routes | production URL, main routes |
| Runs on | hosting project and service names (no secrets) |
| Data | database / storage, and who else reads it |
| Owner rules | the file with this app's rules (its `CLAUDE.md`) |

## What it does

The questions it answers or the jobs it does, in the order a user meets them.

## How it works

The main flow from input to output, and the entry-point functions or files a new contributor
should open first.

## Code map

```
folder/   what lives here
```

## Data

Tables or files it owns (with the migration that creates them), and what it reads from elsewhere.

## Connections

| Direction | Other app or module | Contract (URL, API, function, table) | Defined in | Tested by |
|---|---|---|---|---|
| reads from / sends to | | | | |

Write "None" if it is standalone. Every row must also appear on the other side's page and in the
registry if it crosses an app boundary.

## Rules and decisions

Rules that must not change without approval, and open decisions (with their IDs) waiting for Guy/Ben.

## Run, test, deploy

Commands, environment variables (names only), and the definition of done.

## Status and known gaps

What isn't built yet, known limitations, and where they're tracked.

## Read next

Specs, alignment docs, skills.
