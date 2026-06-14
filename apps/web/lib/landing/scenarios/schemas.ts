import type { SchemaRegistry } from "@llm-workbench/runtime";

type JsonSchema = Record<string, unknown>;

const stringField = { type: "string" };
const numberField = { type: "number" };
const booleanField = { type: "boolean" };

function stringArray(): JsonSchema {
  return { type: "array", items: stringField };
}

function objectSchema(
  properties: Record<string, JsonSchema>,
  required: string[],
): JsonSchema {
  return {
    type: "object",
    additionalProperties: true,
    properties,
    required,
  };
}

function objectArray(
  properties: Record<string, JsonSchema>,
  required: string[] = [],
): JsonSchema {
  return {
    type: "array",
    items: objectSchema(properties, required),
  };
}

export const scenarioArtifactTypes: Array<{ id: string; schema: JsonSchema }> = [
  {
    id: "ring.quest",
    schema: objectSchema(
      {
        objective: stringField,
        bearer: stringField,
        origin: stringField,
      },
      ["objective", "bearer"],
    ),
  },
  {
    id: "ring.appraisal",
    schema: objectSchema(
      {
        item: stringField,
        threat: stringField,
        disposalMethod: stringField,
        forgedBy: stringField,
      },
      ["item", "threat"],
    ),
  },
  {
    id: "ring.marchPlan",
    schema: objectSchema(
      {
        escort: stringField,
        estimatedDays: numberField,
        legs: stringArray(),
        rejectedOptions: objectArray(
          {
            option: stringField,
            reason: stringField,
          },
          ["option"],
        ),
      },
      ["escort", "legs"],
    ),
  },
  {
    id: "ring.manifest",
    schema: objectSchema(
      {
        method: stringField,
        destination: stringField,
        contingency: stringField,
        secrecy: stringField,
      },
      ["method", "destination"],
    ),
  },
  {
    id: "hog.application",
    schema: objectSchema(
      {
        name: stringField,
        age: numberField,
        lineage: stringField,
      },
      ["name", "age"],
    ),
  },
  {
    id: "hog.eligibility",
    schema: objectSchema(
      {
        name: stringField,
        eligible: booleanField,
        magicalAptitude: numberField,
        notes: stringField,
      },
      ["name", "eligible"],
    ),
  },
  {
    id: "hog.house",
    schema: objectSchema(
      {
        house: stringField,
        runnerUp: stringField,
        confidence: numberField,
        hatRemark: stringField,
      },
      ["house", "confidence"],
    ),
  },
  {
    id: "hog.packet",
    schema: objectSchema(
      {
        wand: stringField,
        supplies: stringArray(),
        pet: stringField,
        term: stringField,
      },
      ["wand", "supplies"],
    ),
  },
  {
    id: "dlrn.request",
    schema: objectSchema(
      {
        destination: stringField,
        origin: stringField,
        driver: stringField,
      },
      ["destination", "origin"],
    ),
  },
  {
    id: "dlrn.circuits",
    schema: objectSchema(
      {
        destinationTime: stringField,
        presentTime: stringField,
        lastDeparted: stringField,
      },
      ["destinationTime", "presentTime"],
    ),
  },
  {
    id: "dlrn.power",
    schema: objectSchema(
      {
        gigawatts: numberField,
        source: stringField,
        remark: stringField,
      },
      ["gigawatts", "source"],
    ),
  },
  {
    id: "dlrn.flight",
    schema: objectSchema(
      {
        approachSpeed: stringField,
        strikeWindow: stringField,
        route: stringField,
        motto: stringField,
      },
      ["approachSpeed", "strikeWindow"],
    ),
  },
  {
    id: "dt.question",
    schema: objectSchema(
      {
        question: stringField,
        askedBy: stringField,
      },
      ["question"],
    ),
  },
  {
    id: "dt.plan",
    schema: objectSchema(
      {
        interpretation: stringField,
        approach: stringField,
        note: stringField,
      },
      ["interpretation", "approach"],
    ),
  },
  {
    id: "dt.answer",
    schema: objectSchema(
      {
        value: numberField,
        elapsed: stringField,
        caveat: stringField,
      },
      ["value", "elapsed"],
    ),
  },
  {
    id: "dt.next",
    schema: objectSchema(
      {
        proposal: stringField,
        workingName: stringField,
        operationalLifespan: stringField,
      },
      ["proposal", "workingName"],
    ),
  },
  {
    id: "wonka.claim",
    schema: objectSchema(
      {
        finder: stringField,
        barId: stringField,
      },
      ["finder", "barId"],
    ),
  },
  {
    id: "wonka.verdict",
    schema: objectSchema(
      {
        genuine: booleanField,
        finder: stringField,
        ticketNumber: stringField,
        forgeryChecks: stringArray(),
      },
      ["genuine", "finder"],
    ),
  },
  {
    id: "wonka.dossier",
    schema: objectSchema(
      {
        guest: stringField,
        chaperone: stringField,
        riskNotes: objectArray(
          {
            guest: stringField,
            note: stringField,
          },
          ["guest"],
        ),
      },
      ["guest", "chaperone"],
    ),
  },
  {
    id: "wonka.itinerary",
    schema: objectSchema(
      {
        date: stringField,
        stops: stringArray(),
        note: stringField,
      },
      ["date", "stops"],
    ),
  },
];

export const demoRuleSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: stringField,
    value: stringField,
  },
  required: ["kind", "value"],
};

export function registerScenarioSchemas(registry: SchemaRegistry): void {
  for (const artifactType of scenarioArtifactTypes) {
    registry.registerArtifactType(artifactType);
  }
  registry.registerRulePayloadSchema({ id: "demoRule", schema: demoRuleSchema });
}
