import { z } from "zod";

export const ArtifactPointerSchema = z.object({
  kind: z.enum(["inline", "external"]),
  /** For inline: not used. For external: URL or storage key */
  ref: z.string().optional(),
  /** SHA-256 hex of canonical JSON for inline artifacts */
  sha256: z.string().optional(),
  byteLength: z.number().int().nonnegative().optional(),
});

export type ArtifactPointer = z.infer<typeof ArtifactPointerSchema>;

export const ArtifactVersionSchema = z.object({
  artifactKey: z.string().min(1),
  typeId: z.string().min(1),
  version: z.number().int().positive(),
  createdAt: z.string().datetime({ offset: true }),
  pointer: ArtifactPointerSchema.optional(),
  /** Inline snapshot for small artifacts; omit when using pointer */
  data: z.unknown().optional(),
});

export type ArtifactVersion = z.infer<typeof ArtifactVersionSchema>;
