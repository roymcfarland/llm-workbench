// Allow side-effect CSS imports inside this package (e.g. the
// `@xyflow/react/dist/style.css` import in WorkflowGraph.tsx) when compiled
// with `tsc`. Bundlers in the host application (Next.js, Vite, etc.) handle
// the actual CSS at consumption time.
declare module "*.css";
