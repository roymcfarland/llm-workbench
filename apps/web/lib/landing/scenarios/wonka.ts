import type { DemoScenario } from "./types";

export const wonka: DemoScenario = {
  id: "wonka",
  title: "Golden Ticket Auditor",
  blurb: "Verifying a Golden Ticket and scheduling the factory tour",
  build(runtime) {
    const { runId } = runtime.startRun({
      workflow: {
        id: "goldenTicket",
        version: 1,
        title: "Golden Ticket Auditor",
        steps: [
          {
            id: "authenticate",
            gatePolicy: "PAUSE_BEFORE" as const,
            inputs: ["claim"],
            outputs: ["verdict"],
          },
          {
            id: "vet",
            gatePolicy: "AUTO" as const,
            inputs: ["verdict"],
            outputs: ["dossier"],
          },
          {
            id: "schedule",
            gatePolicy: "PAUSE_AFTER" as const,
            inputs: ["dossier"],
            outputs: ["itinerary"],
          },
        ],
        edges: [
          { id: "e1", from: "authenticate", to: "vet" },
          { id: "e2", from: "vet", to: "schedule" },
        ],
      },
      ruleSets: [
        {
          id: "wonka-policy",
          ruleSchemaId: "demoRule",
          rules: [
            {
              id: "r1",
              priority: 0,
              enabled: true,
              label: "One ticket per child",
              payload: { kind: "policy", value: "one-per-child" },
            },
            {
              id: "r2",
              priority: 1,
              enabled: true,
              label: "A grown-up must accompany each child",
              payload: { kind: "require", value: "chaperone" },
            },
          ],
        },
      ],
      initialArtifacts: [
        {
          artifact: {
            artifactKey: "claim",
            typeId: "wonka.claim",
            data: { finder: "Charlie Bucket", barId: "WW-BAR-#0007" },
          },
        },
      ],
    });

    const s = runtime.session(runId);
    s.resolveGate({
      stepId: "authenticate",
      gate: "PAUSE_BEFORE",
      decision: "approved",
      note: "The fifth and final ticket — press attention is high, verify carefully.",
    });
    s.beginStep("authenticate");
    s.logModelIO({
      stepId: "authenticate",
      direction: "response",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      usage: { inputTokens: 100, outputTokens: 36, totalTokens: 136 },
      cost: { amount: 0.0022, currency: "USD" },
      durationMs: 170,
    });
    s.logToolCall({
      stepId: "authenticate",
      name: "authenticateTicket",
      args: { barId: "WW-BAR-#0007" },
      result: { genuine: true, serial: "GT-05/05" },
    });
    s.writeArtifact({
      artifactKey: "verdict",
      typeId: "wonka.verdict",
      data: {
        genuine: true,
        finder: "Charlie Bucket",
        ticketNumber: "5 of 5",
        forgeryChecks: ["watermark", "golden foil", "Wonka seal"],
      },
    });
    s.completeStep("authenticate");

    s.beginStep("vet");
    s.logModelIO({
      stepId: "vet",
      direction: "response",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      usage: { inputTokens: 240, outputTokens: 120, totalTokens: 360 },
      cost: { amount: 0.0094, currency: "USD" },
      durationMs: 380,
    });
    s.writeArtifact({
      artifactKey: "dossier",
      typeId: "wonka.dossier",
      data: {
        guest: "Charlie Bucket",
        chaperone: "Grandpa Joe",
        riskNotes: [
          { guest: "Augustus Gloop", note: "Keep clear of the chocolate river." },
          { guest: "Veruca Salt", note: "Do not admit to the Nut-Sorting Room." },
          { guest: "Violet Beauregarde", note: "No experimental gum." },
        ],
      },
    });
    s.completeStep("vet");

    s.beginStep("schedule");
    s.logToolCall({
      stepId: "schedule",
      name: "scheduleTour",
      args: { guests: 5 },
      result: { date: "tomorrow, 10:00 sharp" },
    });
    s.writeArtifact({
      artifactKey: "itinerary",
      typeId: "wonka.itinerary",
      data: {
        date: "Tomorrow, 10:00",
        stops: [
          "Chocolate Room",
          "Inventing Room",
          "Television Room",
          "Great Glass Elevator",
        ],
        note: "The whole factory, Charlie — one day it's all yours.",
      },
    });
    s.completeStep("schedule");
    s.resolveGate({
      stepId: "schedule",
      gate: "PAUSE_AFTER",
      decision: "approved",
      note: "Tour confirmed. Send the golden invitation.",
    });
    s.completeRun({ reason: "We have a winner." });

    return runId;
  },
};
