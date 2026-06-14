import type { DemoScenario } from "./types";

export const ring: DemoScenario = {
  id: "ring",
  title: "Fellowship Logistics Agent",
  blurb: "Securely disposing of a world-ending artifact",
  build(runtime) {
    const { runId } = runtime.startRun({
      workflow: {
        id: "ringDisposal",
        version: 1,
        title: "Fellowship Logistics Agent",
        steps: [
          {
            id: "appraise",
            gatePolicy: "PAUSE_BEFORE" as const,
            inputs: ["quest"],
            outputs: ["appraisal"],
          },
          {
            id: "routePlan",
            gatePolicy: "PAUSE_AFTER" as const,
            inputs: ["appraisal"],
            outputs: ["marchPlan"],
          },
          {
            id: "manifest",
            gatePolicy: "AUTO" as const,
            inputs: ["marchPlan"],
            outputs: ["disposalManifest"],
          },
        ],
        edges: [
          { id: "e1", from: "appraise", to: "routePlan" },
          { id: "e2", from: "routePlan", to: "manifest" },
        ],
      },
      ruleSets: [
        {
          id: "fellowship-policy",
          ruleSchemaId: "demoRule",
          rules: [
            {
              id: "r1",
              priority: 0,
              enabled: true,
              label: "Do not use the Ring",
              payload: { kind: "forbid", value: "wear-ring" },
            },
            {
              id: "r2",
              priority: 1,
              enabled: true,
              label: "No detour to Isengard",
              payload: { kind: "forbid", value: "Isengard" },
            },
          ],
        },
      ],
      initialArtifacts: [
        {
          artifact: {
            artifactKey: "quest",
            typeId: "ring.quest",
            data: {
              objective: "Destroy the One Ring",
              bearer: "Frodo Baggins",
              origin: "Mount Doom, Second Age",
            },
          },
        },
      ],
    });

    const s = runtime.session(runId);
    s.resolveGate({
      stepId: "appraise",
      gate: "PAUSE_BEFORE",
      decision: "approved",
      note: "Council of Elrond: the quest is authorized.",
    });
    s.beginStep("appraise");
    s.logModelIO({
      stepId: "appraise",
      direction: "response",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      usage: { inputTokens: 140, outputTokens: 52, totalTokens: 192 },
      cost: { amount: 0.0031, currency: "USD" },
      durationMs: 210,
    });
    s.logToolCall({
      stepId: "appraise",
      name: "appraiseArtifact",
      args: { item: "The One Ring" },
      result: { threat: "world-ending", indestructibleBy: ["fire", "force", "sea"] },
    });
    s.writeArtifact({
      artifactKey: "appraisal",
      typeId: "ring.appraisal",
      data: {
        item: "The One Ring",
        threat: "world-ending",
        disposalMethod: "volcanic reflow at the Cracks of Doom",
        forgedBy: "Sauron",
      },
    });
    s.completeStep("appraise");

    s.beginStep("routePlan");
    s.logModelIO({
      stepId: "routePlan",
      direction: "response",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      usage: { inputTokens: 320, outputTokens: 180, totalTokens: 500 },
      cost: { amount: 0.0125, currency: "USD" },
      durationMs: 540,
    });
    s.logToolCall({
      stepId: "routePlan",
      name: "planRoute",
      args: { from: "Rivendell", to: "Mount Doom", avoid: ["Moria", "Isengard"] },
      result: { legs: 7, days: 182 },
    });
    s.writeArtifact({
      artifactKey: "marchPlan",
      typeId: "ring.marchPlan",
      data: {
        escort: "Fellowship of Nine",
        estimatedDays: 182,
        legs: [
          "Rivendell",
          "Lothlórien",
          "Anduin",
          "Emyn Muil",
          "Dead Marshes",
          "Cirith Ungol",
          "Mount Doom",
        ],
        rejectedOptions: [
          {
            option: "Charter the Great Eagles",
            reason: "Unavailable — they are not a taxi service.",
          },
        ],
      },
    });
    s.completeStep("routePlan");
    s.resolveGate({
      stepId: "routePlan",
      gate: "PAUSE_AFTER",
      decision: "edited",
      note: "The Black Gate is sealed; reroute via Cirith Ungol. Eagles on standby for extraction only.",
    });

    s.beginStep("manifest");
    s.writeArtifact({
      artifactKey: "disposalManifest",
      typeId: "ring.manifest",
      data: {
        method: "volcanic",
        destination: "Cracks of Doom",
        contingency: "If the bearer falls, Samwise Gamgee assumes the burden.",
        secrecy: "absolute",
      },
    });
    s.completeStep("manifest");
    s.completeRun({ reason: "The Ring goes to the Fire." });

    return runId;
  },
};
