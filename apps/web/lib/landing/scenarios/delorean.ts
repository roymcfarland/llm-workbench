import type { DemoScenario } from "./types";

export const delorean: DemoScenario = {
  id: "delorean",
  title: "DeLorean Flight Computer",
  blurb: "Plotting a jump through time at 88 mph",
  build(runtime) {
    const { runId } = runtime.startRun({
      workflow: {
        id: "timeJump",
        version: 1,
        title: "DeLorean Flight Computer",
        steps: [
          {
            id: "setCircuits",
            gatePolicy: "AUTO" as const,
            inputs: ["request"],
            outputs: ["circuits"],
          },
          {
            id: "power",
            gatePolicy: "PAUSE_BEFORE" as const,
            inputs: ["circuits"],
            outputs: ["powerPlan"],
          },
          {
            id: "launch",
            gatePolicy: "PAUSE_AFTER" as const,
            inputs: ["powerPlan"],
            outputs: ["flightCard"],
          },
        ],
        edges: [
          { id: "e1", from: "setCircuits", to: "power" },
          { id: "e2", from: "power", to: "launch" },
        ],
      },
      ruleSets: [
        {
          id: "temporal-safety",
          ruleSchemaId: "demoRule",
          rules: [
            {
              id: "r1",
              priority: 0,
              enabled: true,
              label: "Avoid your past self",
              payload: { kind: "forbid", value: "self-encounter" },
            },
            {
              id: "r2",
              priority: 1,
              enabled: true,
              label: "Preserve the continuum",
              payload: { kind: "policy", value: "no-paradox" },
            },
          ],
        },
      ],
      initialArtifacts: [
        {
          artifact: {
            artifactKey: "request",
            typeId: "dlrn.request",
            data: {
              destination: "1955-11-05",
              origin: "1985-10-26",
              driver: "Marty McFly",
            },
          },
        },
      ],
    });

    const s = runtime.session(runId);
    s.beginStep("setCircuits");
    s.logToolCall({
      stepId: "setCircuits",
      name: "setTimeCircuits",
      args: { destination: "1955-11-05" },
      result: { locked: true },
    });
    s.writeArtifact({
      artifactKey: "circuits",
      typeId: "dlrn.circuits",
      data: {
        destinationTime: "1955-11-05 06:00",
        presentTime: "1985-10-26 01:35",
        lastDeparted: "—",
      },
    });
    s.completeStep("setCircuits");

    s.resolveGate({
      stepId: "power",
      gate: "PAUSE_BEFORE",
      decision: "approved",
      note: "Plutonium unavailable — authorizing a lightning strike as the power source.",
    });
    s.beginStep("power");
    s.logModelIO({
      stepId: "power",
      direction: "response",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      usage: { inputTokens: 180, outputTokens: 90, totalTokens: 270 },
      cost: { amount: 0.0072, currency: "USD" },
      durationMs: 300,
    });
    s.logToolCall({
      stepId: "power",
      name: "computePower",
      args: { required: "1.21GW" },
      result: { gigawatts: 1.21, source: "lightning" },
    });
    s.writeArtifact({
      artifactKey: "powerPlan",
      typeId: "dlrn.power",
      data: {
        gigawatts: 1.21,
        source: "Hill Valley clock-tower lightning strike",
        remark: "1.21 gigawatts! Great Scott!",
      },
    });
    s.completeStep("power");

    s.beginStep("launch");
    s.logToolCall({
      stepId: "launch",
      name: "alignStrike",
      args: { location: "Courthouse Square" },
      result: {
        strikeTime: "1955-11-12 22:04:00",
        certainty: "to the second",
      },
    });
    s.writeArtifact({
      artifactKey: "flightCard",
      typeId: "dlrn.flight",
      data: {
        approachSpeed: "88 mph",
        strikeWindow: "1955-11-12 22:04:00",
        route: "down Courthouse Square to the cable",
        motto: "Roads? Where we're going we don't need roads.",
      },
    });
    s.completeStep("launch");
    s.resolveGate({
      stepId: "launch",
      gate: "PAUSE_AFTER",
      decision: "approved",
      note: "Cable connected. Hit 88 on my mark.",
    });
    s.completeRun({ reason: "Temporal displacement nominal." });

    return runId;
  },
};
