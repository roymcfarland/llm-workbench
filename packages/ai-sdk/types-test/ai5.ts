import { Output, type LanguageModel } from "ai";
import type { WorkbenchSession } from "@llm-workbench/runtime";
import { z } from "zod";
import { tracedGenerateText as generate, tracedStreamText as stream } from "../dist/index.js";
import type { Assert } from "./common.js";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
declare const session: WorkbenchSession;
declare const model: LanguageModel;
const schema = z.object({ name: z.string(), count: z.number() });
const result = await generate(session, { model, prompt: "test", experimental_output: Output.object({ schema }) });
export type Exact = Assert<Equal<typeof result.experimental_output, z.infer<typeof schema>>>;
// @ts-expect-error output is not any
const unrelated: { nope: boolean } = result.experimental_output;
const streaming = stream(session, { model, prompt: "test", experimental_output: Output.object({ schema }) });
for await (const partial of streaming.experimental_partialOutputStream) {
 const name: string | undefined = partial.name;
 // @ts-expect-error partial fields are schema typed
 const bad: number = partial.name;
}

const text = await generate(session, { model, prompt: "test", experimental_output: Output.text() });
export type Text = Assert<Equal<typeof text.experimental_output, string>>;
// @ts-expect-error Output.text stays string
const badText: number = text.experimental_output;

// Extra keys must never select the other SDK's unsupported output option.
const bothKeys = await generate(session, { model, prompt: "test", experimental_output: Output.object({ schema }), output: Output.text() });
export type SupportedKey = Assert<Equal<typeof bothKeys.experimental_output, z.infer<typeof schema>>>;
// @ts-expect-error inference must follow the supported object specification
const wrongKey: string = bothKeys.experimental_output;
const undefinedOutput = await generate(session, { model, prompt: "test", experimental_output: undefined });
const oldUndefined: Awaited<ReturnType<typeof import("ai").generateText>> = undefinedOutput;
const backUndefined: typeof undefinedOutput = oldUndefined;
// @ts-expect-error undefined output preserves ordinary member types
const badUndefined: number = backUndefined.text;

// @ts-expect-error SDK 5 has no complete structured-output promise
streaming.output;
// @ts-expect-error SDK 5 has no array output factory
Output.array;
// @ts-expect-error SDK 5 has no choice output factory
Output.choice;
// @ts-expect-error SDK 5 has no json output factory
Output.json;
