declare module "@/lib/security/precompiled-validators.generated.mjs" {
  import type { ValidateFunction } from "ajv";

  export const precompiledValidators: Readonly<Record<string, ValidateFunction<unknown>>>;
}
