import { z } from "zod";

export const RuleRecordSchema = z.object({
  id: z.string().min(1),
  priority: z.number().int(),
  enabled: z.boolean(),
  label: z.string().optional(),
  /** Host-defined payload (validated separately against rule schema id) */
  payload: z.unknown(),
});

export type RuleRecord = z.infer<typeof RuleRecordSchema>;

export const RuleSetSchema = z.object({
  id: z.string().min(1),
  /** Registry key for JSON Schema used to validate each rule payload */
  ruleSchemaId: z.string().min(1),
  rules: z.array(RuleRecordSchema),
});

export type RuleSet = z.infer<typeof RuleSetSchema>;
