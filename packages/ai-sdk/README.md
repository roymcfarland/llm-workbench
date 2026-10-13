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

### AI SDK 5 and `npm audit`

As of October 13, 2026, AI SDK 5.0.223 through 5.0.274 produce `npm audit`
findings through `ai@5` → `@ai-sdk/provider-utils@3.0.31–3.0.41` →
`undici@5.29.0` → `@fastify/busboy@2.1.1`.
Earlier published AI SDK 5.0.x releases (5.0.0 through 5.0.222) do not depend on
`undici`.
These findings originate in AI SDK 5's dependencies; this package declares no
`undici` dependency.
As of that date, `undici` 5.x has no patched release, and no AI SDK 5 release
uses a newer `undici` version.
To move off that dependency tree within this package's supported peers, upgrade
to AI SDK 7.
The peer range is unchanged, and AI SDK 5 remains supported as before.

## Migrating from `tracedGenerateObject` / `tracedStreamObject`

AI SDK [deprecated `generateObject` and `streamObject` in version 6](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0#generateobject-and-streamobject-deprecation)
in favor of `generateText` / `streamText` with an `output` setting. The plain
`output` API requires AI SDK 6 or later, including 7; use **AI SDK 7** with this
package's current peer range, which excludes 6. AI SDK 5 uses
`experimental_output` instead. Both versions preserve schema-inferred output
through the text wrappers; the examples below identify the SDK they use.

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

After (AI SDK 7):

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
const profile: z.infer<typeof schema> = result.output; // { name: string; count: number }
```

**Supply `toData` when persisting an object.** The text wrappers' default
artifact projectors persist `result.text` (the JSON **string**), even when
`output: Output.object({ schema })` returns a parsed object. `toData` overrides
that projector. Adding a `registry` to `writeArtifact` validates the projected
data against `typeId`; an invalid artifact throws `WorkbenchError` with code
`INVALID_INPUT` for `tracedGenerateText`.

Previously, `tracedGenerateText` erased the output generic, so SDK 7's
`result.output` was `any` and required `schema.parse(result.output)` to recover
its type. It now infers `z.infer<typeof schema>` directly. SDK 5 likewise infers
`result.experimental_output`. The SDK still parses and validates the response
at runtime. Calls without an output specification, and options variables
already annotated as `TracedGenerateTextOptions`, retain their existing result
types. `writeArtifact.toData` keeps its existing loose parameter type; it does
not infer the specific schema from the enclosing options.

After (AI SDK 5.0.273):

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
  experimental_output: Output.object({ schema }),
  writeArtifact: {
    artifactKey: "profile",
    typeId: "profile",
    toData: (r) => schema.parse(r.experimental_output),
  },
});
const profile: z.infer<typeof schema> = result.experimental_output;
```

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
const profile: z.infer<typeof schema> = await stream.output;
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

Both versions infer the partial object fields in their output streams. SDK 7
also infers the awaited `stream.output`, and the wrappers preserve the SDK's
`Output.text()`, `Output.array()`, `Output.choice()`, and `Output.json()` types.
SDK 5 supports `Output.text()` and `Output.object()`; it has no complete
structured-output promise on the stream handle and no array/choice/json output
factories.

After (AI SDK 5.0.273):

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
  experimental_output: Output.object({ schema }),
  writeArtifact: {
    artifactKey: "profile",
    typeId: "profile",
    toData: ({ text }) => schema.parse(JSON.parse(text)),
  },
});
for await (const partial of stream.experimental_partialOutputStream) {
  const name: string | undefined = partial.name;
  void name; // Update your UI with each partial object.
}
const profile = schema.parse(JSON.parse(await stream.text));
```

The SDK 5 example parses the completed text to obtain the final object and
artifact data. Its default artifact projector still writes that text string.

## Docs

- Overview and architecture: repository root [`README.md`](../../README.md).
- Getting started: https://www.llmworkbench.io/docs/getting-started
- Architecture deep-dive: https://www.llmworkbench.io/docs/architecture
- Generated API reference: https://www.llmworkbench.io/docs/api
