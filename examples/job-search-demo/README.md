# Job Search Demo

This is the fastest local way to feel the full LLM Workbench surface.

It is a Vite React app that drives a simulated job-search workflow through the
runtime and `WorkbenchShell`: workflow steps, human gates, artifacts, rules,
trace events, run persistence, forks, and bundle import/export all show up in
one small app.

## Run It

From the repository root:

```bash
npm run demo
```

Or from this directory:

```bash
npm run dev
```

Vite serves the app at `http://localhost:5173`.

## What To Try

- Click `Run parser1 (pseudo)` to resolve the first gate, emit model I/O, and
  write the `compiledProfile` artifact.
- Click `Run jobSearcher (pseudo)` to emit a tool call and write
  `potentialJobs`.
- Click `Approve + score (pseudo)` to approve the post-search gate and write
  `scoredResults`.
- Use the shell tabs to inspect artifacts, rules, trace history, workflow
  state, gates, and bundle import/export.
- Save a run, fork it, then load or compare saved runs from the controls above
  the shell.

The workflow is intentionally fake; the workbench behavior is real. The demo is
useful for local UI/runtime exploration without wiring a model provider or a
database.

For the broader project overview, start at the [root README](../../README.md).
For the hosted reference deployment, see [`apps/web`](../../apps/web).
