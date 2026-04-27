"use client";

import { useMemo, useState } from "react";

import { highlightLines } from "@/lib/landing/highlight";

const RAW_CODE = `import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o-mini'),
  system: 'You score job listings.',
  prompt: 'Rate this listing 1-10: ' + listing,
});

console.log(result.text);
// every call is opaque to your platform
// no run id, no spans, no human gate, no replay
`;

const TRACED_CODE = `import { tracedGenerateText } from '@llm-workbench/ai-sdk';
import { openai } from '@ai-sdk/openai';

const result = await tracedGenerateText({
  session,                       // workbench run handle
  stepId: 'scoreListing',
  model: openai('gpt-4o-mini'),
  system: 'You score job listings.',
  prompt: 'Rate this listing 1-10: ' + listing,
});

// emits model_io + spans, persists artifact, all gated by policy
`;

type TraceHint = {
  line: number;
  events: string[];
};

const TRACED_HINTS: TraceHint[] = [
  {
    line: 1,
    events: [
      "import — wires `tracedGenerateText` into your existing AI SDK call",
    ],
  },
  {
    line: 4,
    events: [
      "span_started · scoreListing.generateText",
      "model_io · request",
    ],
  },
  {
    line: 5,
    events: [
      "session.beginStep('scoreListing')  // recorded automatically",
    ],
  },
  {
    line: 6,
    events: [
      "model_io · response · gpt-4o-mini · 220ms · 150 tok · $0.003",
      "span_ended · scoreListing.generateText",
    ],
  },
  {
    line: 9,
    events: [
      "// returned `result` is unchanged from raw `generateText`",
    ],
  },
  {
    line: 12,
    events: [
      "policy · PAUSE_AFTER pauses run for human review",
      "artifact_written · scoredListing v1",
    ],
  },
];

export function CodeDiff() {
  const rawLines = useMemo(() => highlightLines(RAW_CODE.trimEnd()), []);
  const tracedLines = useMemo(
    () => highlightLines(TRACED_CODE.trimEnd()),
    [],
  );
  const [active, setActive] = useState<number | null>(null);

  const activeHint = TRACED_HINTS.find((h) => h.line === active);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CodeBlock
        title="without LLM Workbench"
        subtitle="raw AI SDK call"
        lines={rawLines}
        accent="zinc"
      />
      <CodeBlock
        title="with LLM Workbench"
        subtitle="one import swap"
        lines={tracedLines}
        accent="violet"
        interactive
        activeLine={active}
        onLineClick={(n) => setActive(active === n ? null : n)}
      />
      <div className="lg:col-span-2">
        <div
          aria-live="polite"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/40 p-4 font-mono text-xs"
        >
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            trace events emitted by the line above
          </div>
          {activeHint ? (
            <ul className="flex flex-col gap-1 text-zinc-100">
              {activeHint.events.map((e, i) => (
                <li key={i} className="text-emerald-300">
                  → {e}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--color-muted-foreground)]">
              Click a line on the right to preview which trace events the runtime
              would emit. Every event is durable, replayable, and exported in the
              run bundle.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeBlock({
  title,
  subtitle,
  lines,
  accent,
  interactive,
  activeLine,
  onLineClick,
}: {
  title: string;
  subtitle: string;
  lines: string[];
  accent: "zinc" | "violet";
  interactive?: boolean;
  activeLine?: number | null;
  onLineClick?: (lineNumber: number) => void;
}) {
  const ringCls =
    accent === "violet"
      ? "ring-1 ring-violet-500/30 shadow-[0_30px_80px_-40px_oklch(0.65_0.2_300/0.4)]"
      : "ring-1 ring-zinc-700/40";
  return (
    <figure
      className={`overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/60 ${ringCls}`}
    >
      <figcaption className="flex items-baseline justify-between border-b border-[var(--color-border)] px-4 py-2 text-xs">
        <span className="font-medium text-zinc-100">{title}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          {subtitle}
        </span>
      </figcaption>
      <pre className="m-0 overflow-x-auto p-0 font-mono text-xs leading-relaxed">
        <code className="block">
          {lines.map((html, i) => {
            const lineNumber = i + 1;
            const isActive = interactive && activeLine === lineNumber;
            const lineCls = isActive
              ? "bg-violet-500/15 outline outline-1 outline-violet-500/40"
              : "";
            const content = (
              <>
                <span className="mr-3 inline-block w-6 select-none text-right text-[var(--color-muted-foreground)]">
                  {lineNumber}
                </span>
                <span dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }} />
              </>
            );
            if (interactive && onLineClick) {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onLineClick(lineNumber)}
                  aria-pressed={!!isActive}
                  className={`block w-full cursor-pointer px-3 py-0.5 text-left transition-colors hover:bg-violet-500/10 focus-visible:bg-violet-500/15 focus-visible:outline focus-visible:outline-1 focus-visible:outline-violet-500/60 ${lineCls}`}
                >
                  {content}
                </button>
              );
            }
            return (
              <span key={i} className="block px-3 py-0.5">
                {content}
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );
}

export default CodeDiff;
