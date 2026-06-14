import type { WorkflowSpec } from "@llm-workbench/runtime";

const timeJumpWorkflow = {
  id: "timeJump",
  version: 1,
  title: "DeLorean Flight Computer",
  steps: [
    {
      id: "setCircuits",
      gatePolicy: "AUTO",
      inputs: [],
      outputs: ["timeCircuits"],
    },
    {
      id: "power",
      gatePolicy: "PAUSE_BEFORE",
      inputs: ["timeCircuits"],
      outputs: ["powerPlan"],
    },
    {
      id: "launch",
      gatePolicy: "PAUSE_AFTER",
      inputs: ["powerPlan"],
      outputs: ["flightCard"],
    },
  ],
  edges: [
    { id: "e1", from: "setCircuits", to: "power" },
    { id: "e2", from: "power", to: "launch" },
  ],
} satisfies WorkflowSpec;

/**
 * Server-rendered SVG mirror of the live `<WorkflowGraph>`. Kept identical in
 * shape so search bots, screen readers, and `prefers-reduced-motion` users see
 * the same content the animated hero would eventually settle on.
 */
export function StaticWorkflowSvg({
  status = "completed",
  className,
}: {
  status?: "pending" | "running" | "completed";
  className?: string;
}) {
  const steps = timeJumpWorkflow.steps;
  const nodeWidth = 168;
  const nodeHeight = 64;
  const gapX = 56;
  const totalWidth = steps.length * nodeWidth + (steps.length - 1) * gapX;
  const totalHeight = nodeHeight + 80;

  return (
    <svg
      role="img"
      aria-label={`${timeJumpWorkflow.title} workflow with ${steps.length} steps`}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className={className}
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{timeJumpWorkflow.title}</title>
      <defs>
        <linearGradient id="lwb-edge" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="oklch(0.7 0.12 220)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.7 0.12 220)" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {/* edges */}
      {steps.slice(0, -1).map((_, i) => {
        const x1 = (i + 1) * nodeWidth + i * gapX;
        const x2 = x1 + gapX;
        const y = totalHeight / 2;
        return (
          <line
            key={`edge-${i}`}
            x1={x1}
            y1={y}
            x2={x2}
            y2={y}
            stroke="url(#lwb-edge)"
            strokeWidth={1.5}
          />
        );
      })}
      {/* nodes */}
      {steps.map((step, i) => {
        const x = i * (nodeWidth + gapX);
        const y = (totalHeight - nodeHeight) / 2;
        return (
          <g key={step.id} data-step-id={step.id} data-status={status}>
            <rect
              x={x}
              y={y}
              width={nodeWidth}
              height={nodeHeight}
              rx={10}
              ry={10}
              fill="oklch(0.21 0.006 285.885)"
              stroke="oklch(0.55 0.12 220)"
              strokeWidth={1}
            />
            <text
              x={x + nodeWidth / 2}
              y={y + 26}
              fontSize={14}
              fontWeight={600}
              fill="oklch(0.985 0 0)"
              textAnchor="middle"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {step.id}
            </text>
            <text
              x={x + nodeWidth / 2}
              y={y + 46}
              fontSize={10}
              fill="oklch(0.7 0.015 286)"
              textAnchor="middle"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              {status} · {step.gatePolicy}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
