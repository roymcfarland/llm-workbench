import type { AsyncIterableStream, Output, generateText, streamText } from "ai";

type GenerateTextResult = Awaited<ReturnType<typeof generateText>>;
type StreamTextResult = ReturnType<typeof streamText>;

/** Only a supplied output specification narrows the existing SDK result. */
type OutputSpec<OPTS> = "output" extends keyof Parameters<typeof generateText>[0]
  ? OPTS extends { output: infer SPEC }
    ? SPEC
    : never
  : OPTS extends { experimental_output: infer SPEC }
    ? SPEC
    : never;

type CompleteOutput<SPEC> = SPEC extends Output.Output<infer COMPLETE, infer _PARTIAL>
  ? COMPLETE
  : never;
type PartialOutput<SPEC> = SPEC extends Output.Output<infer _COMPLETE, infer PARTIAL>
  ? PARTIAL
  : never;
type ElementOutput<SPEC> = SPEC extends {
  createElementStreamTransform(): TransformStream<infer _INPUT, infer ELEMENT> | undefined;
}
  ? ELEMENT
  : never;

/** Preserve the installed SDK's result, narrowing its structured output only. */
export type TypedGenerateTextResult<OPTS> = [OutputSpec<OPTS>] extends [never]
  ? GenerateTextResult
  : [OutputSpec<OPTS>] extends [Output.Output<unknown, unknown>]
    ? {
        [KEY in keyof GenerateTextResult]: KEY extends "output" | "experimental_output"
          ? CompleteOutput<OutputSpec<OPTS>>
          : GenerateTextResult[KEY];
      }
    : GenerateTextResult;

/** Narrow only the output members actually exposed by the installed SDK. */
export type TypedStreamTextResult<OPTS> = [OutputSpec<OPTS>] extends [never]
  ? StreamTextResult
  : [OutputSpec<OPTS>] extends [Output.Output<unknown, unknown>]
    ? {
        [KEY in keyof StreamTextResult]: KEY extends "output"
          ? PromiseLike<CompleteOutput<OutputSpec<OPTS>>>
          : KEY extends "partialOutputStream" | "experimental_partialOutputStream"
            ? AsyncIterableStream<PartialOutput<OutputSpec<OPTS>>>
            : KEY extends "elementStream"
              ? AsyncIterableStream<ElementOutput<OutputSpec<OPTS>>>
              : StreamTextResult[KEY];
      }
    : StreamTextResult;
