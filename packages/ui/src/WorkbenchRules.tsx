import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  RuleRecord,
  RuleSet,
  WorkbenchSession,
} from "@llm-workbench/runtime";

export type RuleModalMode = { type: "create" } | { type: "edit"; rule: RuleRecord };

export type SortableRuleRowProps = {
  rule: RuleRecord;
  onToggle: (rule: RuleRecord) => void;
  onEdit: (rule: RuleRecord) => void;
  onDelete: (ruleId: string) => void;
};

/**
 * Pure helper used by the rule reorder handler. Exported so unit tests can
 * verify the new ordering produced from a drag interaction without driving
 * @dnd-kit's keyboard sensor end-to-end (which is flaky in jsdom).
 */
export function computeReorderedRuleIds(
  currentIds: readonly string[],
  activeId: string,
  overId: string,
): string[] | null {
  if (activeId === overId) return null;
  const fromIdx = currentIds.indexOf(activeId);
  const toIdx = currentIds.indexOf(overId);
  if (fromIdx < 0 || toIdx < 0) return null;
  return arrayMove([...currentIds], fromIdx, toIdx);
}

/**
 * Build the callback wired into `<DndContext onDragEnd>` for the rule list.
 * Exposed so tests can pass a mock session and confirm `reorderRules` is
 * called with the expected `orderedRuleIds`.
 */
export function buildRuleReorderHandler(opts: {
  ruleSet: Pick<RuleSet, "id" | "rules"> | undefined;
  session: Pick<WorkbenchSession, "reorderRules"> | null;
}): (event: DragEndEvent) => void {
  return (event) => {
    const { active, over } = event;
    if (!over || !opts.ruleSet || !opts.session) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const currentIds = [...opts.ruleSet.rules]
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.id);
    const next = computeReorderedRuleIds(currentIds, activeId, overId);
    if (!next) return;
    opts.session.reorderRules({
      ruleSetId: opts.ruleSet.id,
      orderedRuleIds: next,
    });
  };
}

export function SortableRuleRow(props: SortableRuleRowProps) {
  const { rule, onToggle, onEdit, onDelete } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const label = rule.label ?? rule.id;
  const summary = JSON.stringify(rule.payload);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`lwb-rule-row${isDragging ? " lwb-rule-row--dragging" : ""}`}
      aria-label={`Rule ${label}`}
      data-rule-id={rule.id}
    >
      <button
        type="button"
        className="lwb-rule-row__grip"
        aria-label={`Drag to reorder rule ${label}. Press space or enter to lift, arrow keys to move, space or enter to drop, escape to cancel.`}
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <div className="lwb-rule-row__main">
        <div className="lwb-rule-row__title">{label}</div>
        <div className="lwb-rule-row__sub">{summary}</div>
      </div>
      <div className="lwb-rule-row__actions">
        <button
          type="button"
          className="lwb-icon-btn"
          onClick={() => onToggle(rule)}
          title={rule.enabled ? "Disable rule" : "Enable rule"}
          aria-pressed={rule.enabled}
        >
          {rule.enabled ? "✓" : "○"}
        </button>
        <button
          type="button"
          className="lwb-icon-btn"
          onClick={() => onEdit(rule)}
          title="Edit rule"
          aria-label={`Edit rule ${label}`}
        >
          ✎
        </button>
        <button
          type="button"
          className="lwb-icon-btn"
          onClick={() => onDelete(rule.id)}
          title="Delete rule"
          aria-label={`Delete rule ${label}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}
