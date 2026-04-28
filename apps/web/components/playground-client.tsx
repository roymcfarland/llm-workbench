"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Save, Sparkles } from "lucide-react";

import {
  HttpRunRepository,
  SchemaRegistry,
  WorkbenchRuntime,
  registerDemoSchemas,
} from "@llm-workbench/runtime";
import { WorkbenchShell } from "@llm-workbench/ui";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { userFacingWorkbenchMessage } from "@/lib/http/workbench-user-message";
import { compileProfileAction } from "@/lib/runtime/server-actions";
import {
  SAMPLE_RESUME,
  initialRuleSet,
  jobSearchWorkflow,
} from "@/lib/workflow/job-search";

type Status = "idle" | "running" | "saving" | "error";

export function PlaygroundClient() {
  const registry = useMemo(() => {
    const r = new SchemaRegistry();
    registerDemoSchemas(r);
    return r;
  }, []);

  const runtime = useMemo(() => new WorkbenchRuntime(), []);
  // HttpRunRepository talks to *this app's* /api/runs. Cookies are forwarded
  // automatically by `credentials: "include"`, so Clerk auth carries through.
  const repo = useMemo(
    () =>
      new HttpRunRepository({
        baseUrl: "/api",
        fetchImpl: (input, init) =>
          fetch(input as RequestInfo, { ...init, credentials: "include" }),
      }),
    [],
  );

  const startedRef = useRef(false);
  const [runId, setRunId] = useState<string>("");
  const [resumeText, setResumeText] = useState<string>(SAMPLE_RESUME);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastModelIo, setLastModelIo] = useState<{
    durationMs: number;
    inputTokens?: number;
    outputTokens?: number;
  } | null>(null);

  // Bootstrap a run on mount (the demo flow expects an active run id).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const { runId } = runtime.startRun({
      workflow: jobSearchWorkflow,
      ruleSets: [initialRuleSet],
      initialArtifacts: [
        {
          artifact: {
            artifactKey: "parserInputs",
            typeId: "parserInputs",
            data: {
              resumeText: SAMPLE_RESUME,
              profiles: [{ label: "GitHub", url: "https://example.com/u" }],
              portfolioUrls: ["https://example.com/p"],
            },
          },
        },
      ],
      tags: ["reference", "playground"],
    });
    runtime.session(runId).requestGate({
      stepId: "parser1",
      gate: "PAUSE_BEFORE",
      reason: "Review resume input before calling the AI gateway.",
    });
    setRunId(runId);
  }, [runtime]);

  const session = useMemo(() => (runId ? runtime.session(runId) : null), [runtime, runId]);

  const runParse = useCallback(async () => {
    if (!session) return;
    setStatus("running");
    setErrorMsg(null);

    session.resolveGate({ stepId: "parser1", gate: "PAUSE_BEFORE", decision: "approved" });
    session.beginStep("parser1");
    session.logModelIO({
      stepId: "parser1",
      direction: "request",
      provider: "anthropic",
      model: "anthropic/claude-haiku-4-5",
      summary: "Compile structured profile from resume text",
    });

    try {
      const result = await compileProfileAction({ resumeText });

      session.writeArtifact({
        artifactKey: "compiledProfile",
        typeId: "compiledProfile",
        data: result.profile,
      });
      session.logModelIO({
        stepId: "parser1",
        direction: "response",
        provider: result.modelIo.provider,
        model: result.modelIo.model,
        durationMs: result.modelIo.durationMs,
        usage: result.modelIo.usage
          ? {
              inputTokens: result.modelIo.usage.inputTokens,
              outputTokens: result.modelIo.usage.outputTokens,
            }
          : undefined,
        summary: "Wrote compiledProfile artifact",
      });
      session.completeStep("parser1");
      setLastModelIo({
        durationMs: result.modelIo.durationMs,
        inputTokens: result.modelIo.usage?.inputTokens,
        outputTokens: result.modelIo.usage?.outputTokens,
      });
      setStatus("idle");
    } catch (e) {
      const message = userFacingWorkbenchMessage(e);
      session.logModelIO({
        stepId: "parser1",
        direction: "response",
        provider: "anthropic",
        model: "anthropic/claude-haiku-4-5",
        summary: `parse failed: ${message}`,
      });
      session.failStep("parser1", { message });
      setErrorMsg(message);
      setStatus("error");
    }
  }, [session, resumeText]);

  const persist = useCallback(async () => {
    if (!runId) return;
    setStatus("saving");
    setErrorMsg(null);
    try {
      const state = runtime.getState(runId);
      if (!state) throw new Error("No run state to persist");
      await repo.save(state);
      setStatus("idle");
    } catch (e) {
      setErrorMsg(userFacingWorkbenchMessage(e));
      setStatus("error");
    }
  }, [repo, runId, runtime]);

  const reset = useCallback(() => {
    startedRef.current = false;
    setRunId("");
    setResumeText(SAMPLE_RESUME);
    setLastModelIo(null);
    setStatus("idle");
    setErrorMsg(null);
    // Re-trigger the bootstrap effect on the next render.
    queueMicrotask(() => {
      const { runId: next } = runtime.startRun({
        workflow: jobSearchWorkflow,
        ruleSets: [initialRuleSet],
        initialArtifacts: [
          {
            artifact: {
              artifactKey: "parserInputs",
              typeId: "parserInputs",
              data: {
                resumeText: SAMPLE_RESUME,
                profiles: [{ label: "GitHub", url: "https://example.com/u" }],
                portfolioUrls: ["https://example.com/p"],
              },
            },
          },
        ],
        tags: ["reference", "playground"],
      });
      runtime.session(next).requestGate({
        stepId: "parser1",
        gate: "PAUSE_BEFORE",
        reason: "Review resume input before calling the AI gateway.",
      });
      startedRef.current = true;
      setRunId(next);
    });
  }, [runtime]);

  const isBusy = status === "running" || status === "saving";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
        </div>
        <p className="max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          A reference job-search workflow. The first step pauses for your review,
          then a server action calls Vercel AI Gateway with a Zod-validated
          structured output schema. Persistence rides on{" "}
          <code className="font-mono text-xs">HttpRunRepository</code> against
          this app&apos;s own <code className="font-mono text-xs">/api/runs</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Step 1 · Compile profile</CardTitle>
              <CardDescription>
                Edit the resume text, then approve the gate to send it through
                AI Gateway.
              </CardDescription>
            </div>
            {lastModelIo ? (
              <Badge variant="success" className="font-mono">
                {lastModelIo.durationMs}ms
                {lastModelIo.inputTokens
                  ? ` · in ${lastModelIo.inputTokens}`
                  : ""}
                {lastModelIo.outputTokens
                  ? ` · out ${lastModelIo.outputTokens}`
                  : ""}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            rows={6}
            disabled={isBusy}
            className="font-mono text-xs leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void runParse()} disabled={isBusy || !session}>
              {status === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {status === "running" ? "Compiling…" : "Approve gate & compile"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void persist()}
              disabled={isBusy || !runId}
            >
              {status === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save snapshot
            </Button>
            <Button variant="ghost" onClick={reset} disabled={isBusy}>
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
            {errorMsg ? (
              <Badge variant="destructive" className="font-mono">
                {errorMsg}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {runId ? (
        <WorkbenchShell
          runtime={runtime}
          runId={runId}
          registry={registry}
          repo={repo}
          artifactKeys={["parserInputs", "compiledProfile", "potentialJobs", "scoredResults"]}
          ruleSetId="default"
          onActiveRunChange={(id) => setRunId(id)}
        />
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
          Booting workbench runtime…
        </div>
      )}
    </div>
  );
}
