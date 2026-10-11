import { generateText, streamText, tool, type LanguageModel } from "ai";
import type { WorkbenchSession } from "@llm-workbench/runtime";
import { z } from "zod";
import { tracedGenerateText as generate, tracedStreamText as stream, type TracedGenerateTextOptions } from "../dist/index.js";
export type Assert<T extends true> = T;
declare const session: WorkbenchSession;
declare const model: LanguageModel;
const result = await generate(session, { model, prompt: "test", onStepFinish(event) {
  const text: string = event.text;
  // @ts-expect-error generate callbacks retain their contextual types
  const bad: number = event.text;
} });
const old: Awaited<ReturnType<typeof generateText>> = result;
const back: typeof result = old;
const text: string = back.text;
// @ts-expect-error text stays string
const badText: number = result.text;
declare const opts: TracedGenerateTextOptions;
const loose = await generate(session, opts);
const oldLoose: Awaited<ReturnType<typeof generateText>> = loose;
const backLoose: typeof loose = oldLoose;
const streaming = stream(session, { model, prompt: "test", onFinish(event) {
  const text: string = event.text;
  // @ts-expect-error event is contextually typed
  const wrong: number = event.text;
}, onChunk(event) {
  // @ts-expect-error unknown field is not allowed
  event.notAField;
}, tools: { x: tool({ inputSchema: z.object({ q: z.string() }), execute: async (args) => {
  const q: string = args.q;
  // @ts-expect-error input remains schema typed
  const wrong: number = args.q;
  return q;
} }) } });
const oldStream: ReturnType<typeof streamText> = streaming;
const backStream: typeof streaming = oldStream;
void [text, badText, backLoose, backStream];
