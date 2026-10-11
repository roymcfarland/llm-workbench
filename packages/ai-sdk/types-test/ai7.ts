import { Output, type LanguageModel } from "ai";
import type { WorkbenchSession } from "@llm-workbench/runtime";
import { z } from "zod";
import { tracedGenerateText as generate, tracedStreamText as stream } from "../dist/index.js";
import type { Assert } from "./common.js";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
declare const session: WorkbenchSession;
declare const model: LanguageModel;
const schema = z.object({ name: z.string(), count: z.number() });
const result = await generate(session, { model, prompt: "test", output: Output.object({ schema }) });
export type Exact = Assert<Equal<typeof result.output, z.infer<typeof schema>>>;
// @ts-expect-error output is not any
const unrelated: { nope: boolean } = result.output;
const streaming = stream(session, { model, prompt: "test", output: Output.object({ schema }) });
for await (const partial of streaming.partialOutputStream) {
 const name: string | undefined = partial.name;
 // @ts-expect-error partial fields are schema typed
 const bad: number = partial.name;
}
export type Complete = Assert<Equal<Awaited<typeof streaming.output>, z.infer<typeof schema>>>;
// @ts-expect-error complete stream output is not any
const wrong: number = await streaming.output;
const text = await generate(session, { model, prompt: "test", output: Output.text() });
export type Text = Assert<Equal<typeof text.output, string>>;
// @ts-expect-error Output.text stays string
const badText: number = text.output;
const array = await generate(session, { model, prompt: "test", output: Output.array({ element: schema }) });
export type Array = Assert<Equal<typeof array.output, z.infer<typeof schema>[]>>;
// @ts-expect-error array output is not any
const badArray: number = array.output[0].name;
const choice = await generate(session, { model, prompt: "test", output: Output.choice({ options: ["yes", "no"] as const }) });
export type Choice = Assert<Equal<typeof choice.output, "yes" | "no">>;
// @ts-expect-error choices stay constrained
const badChoice: "maybe" = choice.output;
const json = await generate(session, { model, prompt: "test", output: Output.json() });
// @ts-expect-error SDK json output stays JSONValue
const badJson: { impossible: () => void } = json.output;

const arrayStream = stream(session, { model, prompt: "test", output: Output.array({ element: schema }) });
for await (const element of arrayStream.elementStream) {
  const name: string = element.name;
  // @ts-expect-error completed array elements retain their schema
  const bad: number = element.name;
}
const withArtifact = await generate(session, { model, prompt: "test", output: Output.object({ schema }), writeArtifact: {
  artifactKey: "profile", typeId: "profile", toData: (r) => r.output,
} });
export type WithArtifact = Assert<Equal<typeof withArtifact.output, z.infer<typeof schema>>>;
// @ts-expect-error retaining the loose projector must preserve return inference
const badArtifact: number = withArtifact.output.name;

// Extra keys must never select the other SDK's unsupported output option.
const bothKeys = await generate(session, { model, prompt: "test", output: Output.object({ schema }), experimental_output: Output.text() });
export type SupportedKey = Assert<Equal<typeof bothKeys.output, z.infer<typeof schema>>>;
// @ts-expect-error inference must follow the supported object specification
const wrongKey: string = bothKeys.output;
const undefinedOutput = await generate(session, { model, prompt: "test", output: undefined });
const oldUndefined: Awaited<ReturnType<typeof import("ai").generateText>> = undefinedOutput;
const backUndefined: typeof undefinedOutput = oldUndefined;
// @ts-expect-error undefined output preserves ordinary member types
const badUndefined: number = backUndefined.text;
