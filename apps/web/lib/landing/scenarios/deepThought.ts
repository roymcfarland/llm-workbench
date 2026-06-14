import type { DemoScenario } from "./types";

export const deepThought: DemoScenario = {
  id: "deepThought",
  title: "Ultimate Question Solver",
  blurb: "Computing the Answer to Life, the Universe, and Everything",
  build(runtime) {
    const { runId } = runtime.startRun({
      workflow: {
        id: "ultimateAnswer",
        version: 1,
        title: "Ultimate Question Solver",
        steps: [
          {
            id: "parse",
            gatePolicy: "AUTO" as const,
            inputs: ["question"],
            outputs: ["plan"],
          },
          {
            id: "compute",
            gatePolicy: "AUTO" as const,
            inputs: ["plan"],
            outputs: ["answer"],
          },
          {
            id: "commission",
            gatePolicy: "PAUSE_AFTER" as const,
            inputs: ["answer"],
            outputs: ["nextProgram"],
          },
        ],
        edges: [
          { id: "e1", from: "parse", to: "compute" },
          { id: "e2", from: "compute", to: "commission" },
        ],
      },
      ruleSets: [
        {
          id: "philosophy",
          ruleSchemaId: "demoRule",
          rules: [
            {
              id: "r1",
              priority: 0,
              enabled: true,
              label: "Show your working",
              payload: { kind: "policy", value: "explain" },
            },
            {
              id: "r2",
              priority: 1,
              enabled: true,
              label: "Never reveal Question and Answer together",
              payload: { kind: "forbid", value: "reveal-both" },
            },
          ],
        },
      ],
      initialArtifacts: [
        {
          artifact: {
            artifactKey: "question",
            typeId: "dt.question",
            data: {
              question: "Life, the Universe, and Everything",
              askedBy: "a race of hyper-intelligent pan-dimensional beings",
            },
          },
        },
      ],
    });

    const s = runtime.session(runId);
    s.beginStep("parse");
    s.logModelIO({
      stepId: "parse",
      direction: "response",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      usage: { inputTokens: 60, outputTokens: 24, totalTokens: 84 },
      cost: { amount: 0.0011, currency: "USD" },
      durationMs: 120,
    });
    s.writeArtifact({
      artifactKey: "plan",
      typeId: "dt.plan",
      data: {
        interpretation: "The Great Question of Life, the Universe, and Everything",
        approach: "exhaustive deliberation",
        note: "Tricky. This will take a while.",
      },
    });
    s.completeStep("parse");

    s.beginStep("compute");
    s.logModelIO({
      stepId: "compute",
      direction: "response",
      provider: "anthropic",
      model: "claude-opus-4-5",
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      durationMs: 42000,
      summary:
        "Seven and a half million years of computation, distilled. You're not going to like it.",
    });
    s.logToolCall({
      stepId: "compute",
      name: "deliberate",
      args: { question: "Everything" },
      result: { answer: 42, certainty: "absolute" },
    });
    s.writeArtifact({
      artifactKey: "answer",
      typeId: "dt.answer",
      data: {
        value: 42,
        elapsed: "7,500,000 years",
        caveat:
          "I checked it very thoroughly, and that quite definitely is the answer. The trouble is, you've never actually known what the question is.",
      },
    });
    s.completeStep("compute");

    s.beginStep("commission");
    s.writeArtifact({
      artifactKey: "nextProgram",
      typeId: "dt.next",
      data: {
        proposal: "Build a computer to derive the Question to which 42 is the Answer.",
        workingName: "Earth",
        operationalLifespan: "10 million years",
      },
    });
    s.completeStep("commission");
    s.resolveGate({
      stepId: "commission",
      gate: "PAUSE_AFTER",
      decision: "approved",
      note: "Commission approved. Begin construction of the Earth.",
    });
    s.completeRun({ reason: "42." });

    return runId;
  },
};
