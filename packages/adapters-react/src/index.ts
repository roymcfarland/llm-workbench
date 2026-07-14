/**
 * `@llm-workbench/adapters-react` — React hooks for subscribing components
 * to live LLM Workbench runtime state.
 *
 * Currently exports {@link useWorkbenchRunRevision}, the low-level primitive
 * that `@llm-workbench/ui`'s `WorkbenchShell` and `WorkflowGraph` use to
 * re-render when a run's state changes.
 *
 * @packageDocumentation
 */
export { useWorkbenchRunRevision } from "./useWorkbenchRunRevision.js";
