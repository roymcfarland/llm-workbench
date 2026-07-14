# `@llm-workbench/adapters-react`

**MIT-licensed** — the React binding for [LLM Workbench](../../README.md). One hook subscribes a component to live run state, built on `useSyncExternalStore` (correct under React 18/19 concurrent rendering, cleans up on unmount).

```bash
npm install @llm-workbench/adapters-react @llm-workbench/runtime
```

## Usage

```tsx
import { useWorkbenchRunRevision } from "@llm-workbench/adapters-react";

function RunStatus({ runtime, runId }) {
  useWorkbenchRunRevision(runtime, runId); // re-renders whenever the run changes
  const state = runtime.getState(runId);
  return <span>{state?.run.status}</span>;
}
```

## API surface

| Export | Role |
| --- | --- |
| `useWorkbenchRunRevision(runtime, runId)` | returns the current run revision (a `number`) and re-renders the component on every change to that run |

## Docs

- Overview and architecture: repository root [`README.md`](../../README.md).
- Getting started: https://www.llmworkbench.io/docs/getting-started
- Architecture deep-dive: https://www.llmworkbench.io/docs/architecture
- Generated API reference: https://www.llmworkbench.io/docs/api
