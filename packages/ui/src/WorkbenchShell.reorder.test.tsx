import type { RuleSet, WorkbenchSession } from "@llm-workbench/runtime";
import type { DragEndEvent } from "@dnd-kit/core";
import { describe, expect, it, vi } from "vitest";
import {
  buildRuleReorderHandler,
  computeReorderedRuleIds,
} from "./WorkbenchRules.js";

function makeRuleSet(ids: string[]): RuleSet {
  return {
    id: "rs",
    ruleSchemaId: "rs.schema",
    rules: ids.map((id, idx) => ({
      id,
      priority: idx,
      enabled: true,
      label: id,
      payload: { kind: "keyword", value: id },
    })),
  };
}

describe("computeReorderedRuleIds", () => {
  it("moves an item from earlier to later position", () => {
    expect(computeReorderedRuleIds(["a", "b", "c", "d"], "a", "c")).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  it("moves an item from later to earlier position", () => {
    expect(computeReorderedRuleIds(["a", "b", "c", "d"], "d", "b")).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  it("returns null when activeId equals overId", () => {
    expect(computeReorderedRuleIds(["a", "b", "c"], "b", "b")).toBeNull();
  });

  it("returns null when ids are unknown", () => {
    expect(computeReorderedRuleIds(["a", "b", "c"], "x", "b")).toBeNull();
    expect(computeReorderedRuleIds(["a", "b", "c"], "b", "x")).toBeNull();
  });
});

describe("buildRuleReorderHandler", () => {
  it("calls session.reorderRules with the dnd-kit-derived ordering", () => {
    const ruleSet = makeRuleSet(["alpha", "beta", "gamma"]);
    const session: Pick<WorkbenchSession, "reorderRules"> = {
      reorderRules: vi.fn(),
    };
    const handler = buildRuleReorderHandler({ ruleSet, session });

    const event: DragEndEvent = {
      active: { id: "alpha", data: { current: undefined } },
      over: { id: "gamma", data: { current: undefined } },
    } as unknown as DragEndEvent;

    handler(event);

    expect(session.reorderRules).toHaveBeenCalledTimes(1);
    expect(session.reorderRules).toHaveBeenCalledWith({
      ruleSetId: "rs",
      orderedRuleIds: ["beta", "gamma", "alpha"],
    });
  });

  it("ignores drops with no over target", () => {
    const ruleSet = makeRuleSet(["a", "b"]);
    const session: Pick<WorkbenchSession, "reorderRules"> = {
      reorderRules: vi.fn(),
    };
    const handler = buildRuleReorderHandler({ ruleSet, session });

    handler({ active: { id: "a", data: { current: undefined } }, over: null } as unknown as DragEndEvent);

    expect(session.reorderRules).not.toHaveBeenCalled();
  });

  it("is a no-op when ruleSet or session are missing", () => {
    const reorderRules = vi.fn();
    const handlerNoSession = buildRuleReorderHandler({
      ruleSet: makeRuleSet(["a", "b"]),
      session: null,
    });
    const handlerNoRuleSet = buildRuleReorderHandler({
      ruleSet: undefined,
      session: { reorderRules },
    });

    const evt: DragEndEvent = {
      active: { id: "a", data: { current: undefined } },
      over: { id: "b", data: { current: undefined } },
    } as unknown as DragEndEvent;

    handlerNoSession(evt);
    handlerNoRuleSet(evt);

    expect(reorderRules).not.toHaveBeenCalled();
  });

  it("sorts rules by priority before computing ordering", () => {
    // priority order: gamma(0), alpha(1), beta(2)
    const ruleSet: RuleSet = {
      id: "rs",
      ruleSchemaId: "rs.schema",
      rules: [
        { id: "alpha", priority: 1, enabled: true, label: "alpha", payload: {} },
        { id: "beta", priority: 2, enabled: true, label: "beta", payload: {} },
        { id: "gamma", priority: 0, enabled: true, label: "gamma", payload: {} },
      ],
    };
    const reorderRules = vi.fn();
    const handler = buildRuleReorderHandler({ ruleSet, session: { reorderRules } });

    handler({
      active: { id: "gamma", data: { current: undefined } },
      over: { id: "beta", data: { current: undefined } },
    } as unknown as DragEndEvent);

    expect(reorderRules).toHaveBeenCalledWith({
      ruleSetId: "rs",
      orderedRuleIds: ["alpha", "beta", "gamma"],
    });
  });
});
