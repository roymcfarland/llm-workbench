# `@llm-workbench/ui`

**MIT-licensed** — React control-surface components for [LLM Workbench](../../README.md). Drop in a ready-made panel to inspect and edit a run — artifacts, rules, trace history, human-review gates, and bundle import/export — or compose the pieces yourself. Requires React and React DOM 18.2+ or 19.

```bash
npm install @llm-workbench/ui @llm-workbench/runtime
```

## Usage

```tsx
import { WorkbenchShell } from "@llm-workbench/ui";
import "@llm-workbench/ui/theme.css";

<WorkbenchShell runtime={runtime} runId={runId} registry={registry} />;
```

The shell subscribes to live run updates itself via `useWorkbenchRunRevision` from its included [`@llm-workbench/adapters-react`](../adapters-react) dependency; no separate install or subscription is needed.

`runtime`, `runId`, and `registry` are required. Optional props are `repo`, `artifactKeys`, `ruleSetId` (default `"default"`), `onActiveRunChange`, and `useMonacoEditor` (default `false`).

By default, the artifact JSON editor is a plain `<textarea>`. Set `useMonacoEditor={true}` to lazy-load Monaco. Monaco is client-only and does not support SSR; the parent route must be a client component, with a client-only boundary when needed.

`@monaco-editor/react` requires the `monaco-editor` peer (`>=0.25.0 <1`). npm 7+ installs peers automatically; pnpm and Yarn users should add it explicitly:

```bash
pnpm add 'monaco-editor@>=0.25.0 <1'
# or
yarn add 'monaco-editor@>=0.25.0 <1'
```

## API surface

| Export | Role |
| --- | --- |
| `WorkbenchShell` | full control panel for a run (artifacts, rules, traces, gates, import/export) |
| `WorkflowGraph` | React Flow DAG view of a workflow + `layoutWorkflow` helper |
| `MonacoArtifactEditor` | Monaco-based JSON artifact editor |
| `@llm-workbench/ui/theme.css` | scoped (`lwb-`) base styles |

## Docs

- Overview and architecture: repository root [`README.md`](../../README.md).
- Getting started: https://www.llmworkbench.io/docs/getting-started
- Architecture deep-dive: https://www.llmworkbench.io/docs/architecture
- Generated API reference: https://www.llmworkbench.io/docs/api
