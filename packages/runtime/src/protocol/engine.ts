import { z } from "zod";

export const StepRuntimeStatusSchema = z.enum(["pending", "running", "completed", "failed"]);

export const GateStatusSchema = z.enum(["approved", "pending"]);

export const StepGateStateSerializedSchema = z
  .object({
    before: GateStatusSchema,
    after: GateStatusSchema,
    checkpoints: z.record(z.string(), GateStatusSchema).optional(),
  })
  .transform((v) => ({ ...v, checkpoints: v.checkpoints ?? {} }));

export const RunBundleEngineSchema = z.object({
  revision: z.number().int().nonnegative(),
  stepStatus: z.array(z.tuple([z.string(), StepRuntimeStatusSchema])),
  gateState: z.array(z.tuple([z.string(), StepGateStateSerializedSchema])),
  idempotency: z.array(z.tuple([z.string(), z.object({ artifactKey: z.string(), version: z.number().int().positive() })])),
});

export type RunBundleEngine = z.infer<typeof RunBundleEngineSchema>;
