import type { DemoScenario } from "./types";

export const hogwarts: DemoScenario = {
  id: "hogwarts",
  title: "Owl Post Admissions Agent",
  blurb: "Processing a Hogwarts letter, start to owl",
  build(runtime) {
    const { runId } = runtime.startRun({
      workflow: {
        id: "hogwartsAdmissions",
        version: 1,
        title: "Owl Post Admissions Agent",
        steps: [
          {
            id: "verify",
            gatePolicy: "PAUSE_BEFORE" as const,
            inputs: ["application"],
            outputs: ["eligibility"],
          },
          {
            id: "sort",
            gatePolicy: "AUTO" as const,
            inputs: ["eligibility"],
            outputs: ["house"],
          },
          {
            id: "supplies",
            gatePolicy: "PAUSE_AFTER" as const,
            inputs: ["house"],
            outputs: ["packet"],
          },
        ],
        edges: [
          { id: "e1", from: "verify", to: "sort" },
          { id: "e2", from: "sort", to: "supplies" },
        ],
      },
      ruleSets: [
        {
          id: "ministry-policy",
          ruleSchemaId: "demoRule",
          rules: [
            {
              id: "r1",
              priority: 0,
              enabled: true,
              label: "No underage magic off-grounds",
              payload: { kind: "policy", value: "no-underage-magic" },
            },
            {
              id: "r2",
              priority: 1,
              enabled: true,
              label: "Muggle-borns welcome",
              payload: { kind: "allow", value: "muggle-born" },
            },
          ],
        },
      ],
      initialArtifacts: [
        {
          artifact: {
            artifactKey: "application",
            typeId: "hog.application",
            data: { name: "Hermione Granger", age: 11, lineage: "Muggle-born" },
          },
        },
      ],
    });

    const s = runtime.session(runId);
    s.resolveGate({
      stepId: "verify",
      gate: "PAUSE_BEFORE",
      decision: "approved",
      note: "The Quill of Acceptance logged the birth; record confirmed.",
    });
    s.beginStep("verify");
    s.logModelIO({
      stepId: "verify",
      direction: "response",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      usage: { inputTokens: 90, outputTokens: 30, totalTokens: 120 },
      cost: { amount: 0.002, currency: "USD" },
      durationMs: 150,
    });
    s.logToolCall({
      stepId: "verify",
      name: "checkRegistry",
      args: { name: "Hermione Granger" },
      result: { found: true, magicalAptitude: 0.98 },
    });
    s.writeArtifact({
      artifactKey: "eligibility",
      typeId: "hog.eligibility",
      data: {
        name: "Hermione Granger",
        eligible: true,
        magicalAptitude: 0.98,
        notes: "Exceptional aptitude; has pre-read every set text.",
      },
    });
    s.completeStep("verify");

    s.beginStep("sort");
    s.logToolCall({
      stepId: "sort",
      name: "sortingHat",
      args: { name: "Hermione Granger" },
      result: { house: "Gryffindor", deliberationSeconds: 47 },
    });
    s.writeArtifact({
      artifactKey: "house",
      typeId: "hog.house",
      data: {
        house: "Gryffindor",
        runnerUp: "Ravenclaw",
        confidence: 0.89,
        hatRemark: "Plenty of courage, I see — and a thirst to prove yourself.",
      },
    });
    s.completeStep("sort");

    s.beginStep("supplies");
    s.logModelIO({
      stepId: "supplies",
      direction: "response",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      usage: { inputTokens: 210, outputTokens: 140, totalTokens: 350 },
      cost: { amount: 0.0089, currency: "USD" },
      durationMs: 360,
    });
    s.writeArtifact({
      artifactKey: "packet",
      typeId: "hog.packet",
      data: {
        wand: "10¾\", vine wood, dragon-heartstring core",
        supplies: [
          "1 cauldron (pewter, standard size 2)",
          "The Standard Book of Spells, Grade 1",
          "1 set of dress robes (black)",
        ],
        pet: "an owl OR a cat OR a toad",
        term: "1 September, Platform 9¾",
      },
    });
    s.completeStep("supplies");
    s.resolveGate({
      stepId: "supplies",
      gate: "PAUSE_AFTER",
      decision: "approved",
      note: "Dispatch by owl; await reply by return owl.",
    });
    s.completeRun({ reason: "Letter delivered. Welcome to Hogwarts." });

    return runId;
  },
};
