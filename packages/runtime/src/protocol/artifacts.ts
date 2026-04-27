import { z } from "zod";

/**
 * Pointer to artifact bytes. The same shape covers small inline artifacts
 * and large externally-stored artifacts:
 *
 * - `kind: "inline"` — bytes live on `ArtifactVersion.data`. `payloadHash`
 *   and `byteLength`, if set, MUST describe the canonical JSON encoding of
 *   that data so they can be verified after replay or redaction.
 * - `kind: "external"` — bytes are stored by an `ArtifactStore`
 *   implementation (S3/Blob/Postgres-large-object/etc.). `ref` is the
 *   opaque storage key returned by `ArtifactStore.put`. `payloadHash` and
 *   `byteLength` describe the bytes that the store will return on `get`,
 *   not any wrapper or envelope, so integrity can be verified end-to-end
 *   without trusting the store.
 *
 * `payloadHash` is preferred over the legacy `sha256` field. When both are
 * set they MUST be equal (lowercase hex). New code should write
 * `payloadHash`; reading code should prefer the helper
 * {@link getArtifactPayloadHash}.
 */
export const ArtifactPointerSchema = z
  .object({
    kind: z.enum(["inline", "external"]),
    /** For inline: not used. For external: opaque storage key returned by `ArtifactStore.put`. */
    ref: z.string().optional(),
    /**
     * SHA-256 (lowercase hex) of the canonical JSON encoding of the
     * artifact payload. Preferred name for new pointers. When both
     * `payloadHash` and `sha256` are set, they MUST match.
     */
    payloadHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    /**
     * @deprecated Prefer `payloadHash`. Kept as an alias so older bundles
     *   round-trip without migration. When both are set they MUST be
     *   equal.
     */
    sha256: z.string().optional(),
    byteLength: z.number().int().nonnegative().optional(),
  })
  .superRefine((p, ctx) => {
    if (p.payloadHash && p.sha256 && p.payloadHash !== p.sha256) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ArtifactPointer.payloadHash and sha256 must be equal when both are set",
        path: ["payloadHash"],
      });
    }
    if (p.kind === "external" && !p.ref) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ArtifactPointer.ref is required when kind === "external"',
        path: ["ref"],
      });
    }
  });

export type ArtifactPointer = z.infer<typeof ArtifactPointerSchema>;

/**
 * Normalize {@link ArtifactPointer} to a single payload hash, preferring
 * `payloadHash` and falling back to the deprecated `sha256` alias. Returns
 * `undefined` when neither is set (older inline pointers).
 */
export function getArtifactPayloadHash(p: ArtifactPointer | undefined): string | undefined {
  if (!p) return undefined;
  return p.payloadHash ?? p.sha256;
}

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
