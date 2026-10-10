# `@llm-workbench/ai-sdk`

**MIT-licensed** — [Vercel AI SDK](https://sdk.vercel.ai) wrappers supporting AI SDK v5 and v7 for [LLM Workbench](../../README.md). Call your model through these instead of the bare AI SDK functions, and each call automatically records a correlated `model_io` trace event (provider, model, token usage, duration) — plus `tool_call` events and AI-Gateway cost — into the active run.

```bash
npm install @llm-workbench/ai-sdk @llm-workbench/runtime ai zod
```

## API surface

| Export | Wraps (from `ai`) |
| --- | --- |
| `tracedGenerateText` / `tracedStreamText` | `generateText` / `streamText` |
| `tracedGenerateObject` / `tracedStreamObject` (deprecated) | `generateObject` / `streamObject` |
| `traceTools` | a tool set, so each invocation logs a `tool_call` event |
| `costFromGatewayMetadata` | derives cost from Vercel AI Gateway response metadata |

Each `traced*` call takes a `WorkbenchSession` first, then an options object: for example, `tracedGenerateText(session, opts)`. The options combine the corresponding AI SDK options with `WorkbenchTraceContext` (`stepId?`, `correlationId?`, `detail?`) and an optional `writeArtifact` hook. See the typed options (`TracedGenerateTextOptions`, etc.) and the reference wiring in [`apps/web`](../../apps/web).

Supported peers are `ai: ^5.0.0 || ^7.0.0` and `zod: ^3.23.8 || ^4.0.0`.

## Migrating from `tracedGenerateObject` / `tracedStreamObject`

AI SDK [deprecated `generateObject` and `streamObject` in version 6](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0#generateobject-and-streamobject-deprecation)
in favor of `generateText` / `streamText` with an `output` setting. The plain
`output` API requires AI SDK 6 or later, including 7; use **AI SDK 7** with this
package's current peer range, which excludes 6. AI SDK 5 uses
`experimental_output` instead (verified against 5.0.273), so the after examples
below do not apply to 5.

The deprecated wrappers keep working unchanged and will be removed only after
AI SDK removes the underlying functions. No removal version has been announced
in the linked migration guide.

### Generating an object

Before:

```ts
import { tracedGenerateObject } from "@llm-workbench/ai-sdk";
import type { WorkbenchSession } from "@llm-workbench/runtime";
import type { LanguageModel } from "ai";
import { z } from "zod";

declare const session: WorkbenchSession;
declare const model: LanguageModel; // Your configured provider model.
const schema = z.object({ name: z.string(), count: z.number() });

const result = await tracedGenerateObject(session, {
  model,
  prompt: "Generate a profile",
  schema,
  writeArtifact: { artifactKey: "profile", typeId: "profile" },
});
const profile = schema.parse(result.object);
```

After:

```ts
import { tracedGenerateText } from "@llm-workbench/ai-sdk";
import type { WorkbenchSession } from "@llm-workbench/runtime";
import { Output, type LanguageModel } from "ai";
import { z } from "zod";

declare const session: WorkbenchSession;
declare const model: LanguageModel;
const schema = z.object({ name: z.string(), count: z.number() });

const result = await tracedGenerateText(session, {
  model,
  prompt: "Generate a profile",
  output: Output.object({ schema }),
  writeArtifact: {
    artifactKey: "profile",
    typeId: "profile",
    toData: (r) => r.output,
  },
});
const profile = schema.parse(result.output);
```

**Supply `toData` when persisting an object.** The text wrappers' default
artifact projectors persist `result.text` (the JSON **string**), even when
`output: Output.object({ schema })` returns a parsed object. `toData` overrides
that projector. Adding a `registry` to `writeArtifact` validates the projected
data against `typeId`; an invalid artifact throws `WorkbenchError` with code
`INVALID_INPUT` for `tracedGenerateText`.

The wrappers use `Parameters` / `ReturnType` rather than preserving the SDK's
schema generic: `result.output` is loosely typed (`any`) through
`tracedGenerateText`. Use `schema.parse(result.output)` to obtain a validated,
schema-inferred value, as above. The runtime SDK still parses and validates
the response against the `Output.object` schema.

### Streaming an object

Before:

```ts
import { tracedStreamObject } from "@llm-workbench/ai-sdk";
import type { WorkbenchSession } from "@llm-workbench/runtime";
import type { LanguageModel } from "ai";
import { z } from "zod";

declare const session: WorkbenchSession;
declare const model: LanguageModel;
const schema = z.object({ name: z.string(), count: z.number() });

const stream = tracedStreamObject(session, {
  model,
  prompt: "Generate a profile",
  schema,
  writeArtifact: { artifactKey: "profile", typeId: "profile" },
});
for await (const partial of stream.partialObjectStream) {
  void partial; // Update your UI with each partial object.
}
const profile = schema.parse(await stream.object);
```

After (tested with AI SDK 7):

```ts
import { tracedStreamText } from "@llm-workbench/ai-sdk";
import type { WorkbenchSession } from "@llm-workbench/runtime";
import { Output, type LanguageModel } from "ai";
import { z } from "zod";

declare const session: WorkbenchSession;
declare const model: LanguageModel;
const schema = z.object({ name: z.string(), count: z.number() });

const stream = tracedStreamText(session, {
  model,
  prompt: "Generate a profile",
  output: Output.object({ schema }),
  writeArtifact: {
    artifactKey: "profile",
    typeId: "profile",
    toData: ({ result }) => schema.parse((result as { output: unknown }).output),
  },
});
for await (const partial of stream.partialOutputStream) {
  void partial; // Update your UI; partial values may have missing fields.
}
const profile = schema.parse(await stream.output);
```

Consume `partialOutputStream` to completion so the stream finishes and emits
the final response trace with usage. Streaming `toData` receives
`{ text: string, result: unknown }`: `text` is the final JSON string and
`result` is the SDK finish event, **not** the returned stream handle. In
AI SDK 7 that event includes the parsed `output`; narrow its unknown type and
validate with `schema.parse`, as shown. Without `toData`, the artifact is again
the JSON string. If registry validation or artifact persistence fails during
streaming, the wrapper emits an `artifact_write_failed` trace; it does not
reject the final structured output.

## Docs

- Overview and architecture: repository root [`README.md`](../../README.md).
- Getting started: https://www.llmworkbench.io/docs/getting-started
- Architecture deep-dive: https://www.llmworkbench.io/docs/architecture
- Generated API reference: https://www.llmworkbench.io/docs/api
