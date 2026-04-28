import { useWorkbenchRunRevision } from "@llm-workbench/adapters-react";
import type {
  StepRuntimeStatus,
  WorkbenchRuntime,
  WorkflowSpec,
} from "@llm-workbench/runtime";
import {
  Background,
  Controls,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { useCallback, useMemo } from "react";

export type WorkflowGraphProps = {
  runtime: WorkbenchRuntime;
  runId: string | null;
  onSelectStep?: (stepId: string) => void;
  className?: string;
  /**
   * Compact in-page preview (e.g. marketing hero): omit minimap and controls so
   * the React Flow chrome cannot overlap a side-by-side trace column on narrow widths.
   */
  embed?: boolean;
};

type WorkflowNodeData = {
  label: string;
  status: StepRuntimeStatus;
};

type WorkflowNode = Node<WorkflowNodeData, "workflowStep">;
type WorkflowEdge = Edge;

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

/**
 * Compute node positions for a workflow using dagre's hierarchical layout.
 * Exported so unit tests can assert deterministic positioning behaviour
 * without rendering React.
 */
export function layoutWorkflow(
  workflow: Pick<WorkflowSpec, "steps" | "edges">,
  statuses: ReadonlyMap<string, StepRuntimeStatus>,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80, marginx: 24, marginy: 24 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const step of workflow.steps) {
    graph.setNode(step.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Only lay out edges whose endpoints are known steps. Dagre throws on
  // dangling references and the runtime currently allows trace-only edges.
  const knownStepIds = new Set(workflow.steps.map((s) => s.id));
  const validEdges = workflow.edges.filter(
    (e) => knownStepIds.has(e.from) && knownStepIds.has(e.to),
  );
  for (const edge of validEdges) {
    graph.setEdge(edge.from, edge.to);
  }

  dagre.layout(graph);

  const nodes: WorkflowNode[] = workflow.steps.map((step) => {
    const node = graph.node(step.id);
    const status = statuses.get(step.id) ?? "pending";
    const fallbackX = workflow.steps.indexOf(step) * (NODE_WIDTH + 40);
    const x = node ? node.x - NODE_WIDTH / 2 : fallbackX;
    const y = node ? node.y - NODE_HEIGHT / 2 : 0;
    return {
      id: step.id,
      type: "workflowStep",
      position: { x, y },
      data: {
        label: step.title ?? step.id,
        status,
      },
    };
  });

  const edges: WorkflowEdge[] = validEdges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    animated:
      statuses.get(edge.from) === "running" || statuses.get(edge.to) === "running",
  }));

  return { nodes, edges };
}

function WorkflowStepNode({ data }: NodeProps<WorkflowNode>) {
  return (
    <div
      className={`lwb-workflow-graph__node lwb-workflow-graph__node--${data.status}`}
      data-testid="workflow-graph-node"
      data-status={data.status}
    >
      <Handle type="target" position={Position.Left} />
      <div className="lwb-workflow-graph__node-title">{data.label}</div>
      <div className="lwb-workflow-graph__node-status">{data.status}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { workflowStep: WorkflowStepNode };

export function WorkflowGraph(props: WorkflowGraphProps) {
  const { runtime, runId, onSelectStep, className, embed = false } = props;
  // Re-render whenever the run's revision counter advances.
  useWorkbenchRunRevision(runtime, runId);
  const state = runId ? runtime.getState(runId) : undefined;

  const { nodes, edges } = useMemo(() => {
    if (!state) return { nodes: [] as WorkflowNode[], edges: [] as WorkflowEdge[] };
    return layoutWorkflow(state.run.workflowSnapshot, state.stepStatus);
  }, [state]);

  const onNodeClick = useCallback(
    (_evt: unknown, node: Node) => {
      onSelectStep?.(node.id);
    },
    [onSelectStep],
  );

  const rootClass = className
    ? `lwb-root lwb-workflow-graph ${className}`
    : "lwb-root lwb-workflow-graph";

  if (!runId || !state) {
    return (
      <div className={rootClass} data-testid="workflow-graph-root">
        <div className="lwb-workflow-graph__empty">No run selected.</div>
      </div>
    );
  }

  return (
    <div className={rootClass} data-testid="workflow-graph-root">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        {embed ? null : (
          <>
            <MiniMap pannable zoomable />
            <Controls showInteractive={false} />
          </>
        )}
      </ReactFlow>
    </div>
  );
}

export default WorkflowGraph;
