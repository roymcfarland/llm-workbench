import { WorkbenchError } from "../errors.js";
import type { RuleSet } from "../protocol/rules.js";
import type { RunLifecycleController } from "./runLifecycleController.js";
import type { SessionContext } from "./sessionContext.js";

export class RuleController {
  constructor(
    private readonly ctx: SessionContext,
    private readonly lifecycle: RunLifecycleController,
  ) {}

  private get runId() {
    return this.ctx.state.run.id;
  }

  replaceRuleSet(ruleSet: RuleSet) {
    this.lifecycle.assertRunActive("replace rule set");
    this.ctx.state.ruleSetsById.set(ruleSet.id, ruleSet);
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "rule_changed",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      ruleSetId: ruleSet.id,
      snapshot: ruleSet,
    });
  }

  reorderRules(input: { ruleSetId: string; orderedRuleIds: string[] }) {
    this.lifecycle.assertRunActive("reorder rules");
    const rs = this.ctx.state.ruleSetsById.get(input.ruleSetId);
    if (!rs) throw new WorkbenchError("UNKNOWN_RULESET", `Unknown ruleSet: ${input.ruleSetId}`);
    if (input.orderedRuleIds.length !== rs.rules.length) {
      throw new WorkbenchError(
        "INVALID_INPUT",
        `reorderRules expected ${rs.rules.length} rule ids, got ${input.orderedRuleIds.length}`,
      );
    }
    if (new Set(input.orderedRuleIds).size !== input.orderedRuleIds.length) {
      throw new WorkbenchError("INVALID_INPUT", "reorderRules rule ids must be unique");
    }
    const byId = new Map(rs.rules.map((r) => [r.id, r] as const));
    const nextRules = input.orderedRuleIds.map((id, idx) => {
      const r = byId.get(id);
      if (!r) throw new WorkbenchError("INVALID_INPUT", `Unknown rule id: ${id}`);
      return { ...r, priority: idx };
    });
    const next: RuleSet = { ...rs, rules: nextRules };
    this.replaceRuleSet(next);
  }

  annotate(input: { text: string; tags?: string[] }) {
    this.lifecycle.assertRunActive("annotate run");
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "annotation",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      text: input.text,
      tags: input.tags,
    });
  }

  forkNotice(parentRunId: string, forkedFromStepId?: string) {
    this.lifecycle.assertRunActive("record fork notice");
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "run_forked",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      parentRunId,
      forkedFromStepId,
    });
  }
}
