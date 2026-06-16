# `@llm-workbench/ui`

**MIT-licensed** — React control-surface components for [LLM Workbench](../../README.md). Drop in a ready-made panel to inspect and edit a run — artifacts, rules, trace history, human-review gates, and bundle import/export — or compose the pieces yourself. Requires React 19.

```bash
npm install @llm-workbench/ui @llm-workbench/runtime
```

## Usage

```tsx
import { WorkbenchShell } from "@llm-workbench/ui";
import "@llm-workbench/ui/theme.css";

<WorkbenchShell runtime={runtime} runId={runId} registry={registry} />;
```

Pair with [`@llm-workbench/adapters-react`](../adapters-react) so the shell re-renders on live run updates.

## API surface

| Export | Role |
| --- | --- |
| `WorkbenchShell` | full control panel for a run (artifacts, rules, traces, gates, import/export) |
| `WorkflowGraph` | React Flow DAG view of a workflow + `layoutWorkflow` helper |
| `MonacoArtifactEditor` | Monaco-based JSON artifact editor |
| `@llm-workbench/ui/theme.css` | scoped (`lwb-`) base styles |

## Docs

Overview and architecture: repository root [`README.md`](../../README.md).
