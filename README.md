# LLM workbench

A small monorepo for a **bolt-on “workbench”** you can embed in applications that call LLMs: a headless runtime records workflows, artifacts, rules, human gates, and traces; optional UI and React helpers subscribe to live state; persistence and run bundles support audits and reuse.

## Packages

| Package | Description |
|--------|-------------|
| `@llm-workbench/runtime` | Protocol types, `WorkbenchRuntime` / `WorkbenchSession`, schema registry (JSON Schema + Ajv), persistence ports, bundle import/export with integrity, structured errors. |
| `@llm-workbench/ui` | `WorkbenchShell`: artifact editor, rules editor, trace timeline, import/export controls (themeable CSS). |
| `@llm-workbench/adapters-react` | `useWorkbenchRunRevision` and related hooks. |

## Quick start

```bash
npm install
npm test
npm run build
npm run demo          # Vite demo app
npm run demo:http-server   # Reference REST store for HttpRunRepository
```

## License

**Proprietary.** All rights reserved. See [LICENSE](LICENSE) for terms. No permission is granted to use, copy, modify, merge, publish, distribute, sublicense, or sell this software except as expressly authorized in writing by the copyright holder.
