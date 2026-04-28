import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type RunCompletionEmailProps = {
  runId: string;
  status: "completed" | "failed" | "cancelled";
  workflowId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  runUrl: string;
  preferencesUrl: string;
};

const COLORS = {
  bg: "#0b0d12",
  card: "#11141b",
  border: "#1f242f",
  text: "#e6e8eb",
  muted: "#8a90a0",
  accent: "#22d3ee",
  emerald: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
} as const;

const STATUS_COPY: Record<
  RunCompletionEmailProps["status"],
  { headline: string; badge: string; tone: keyof typeof COLORS; lede: string }
> = {
  completed: {
    headline: "Run completed",
    badge: "completed",
    tone: "emerald",
    lede: "All steps finished without error.",
  },
  failed: {
    headline: "Run failed",
    badge: "failed",
    tone: "red",
    lede: "A step returned an error before the run could finish.",
  },
  cancelled: {
    headline: "Run cancelled",
    badge: "cancelled",
    tone: "amber",
    lede: "The run was cancelled before reaching a terminal step.",
  },
};

export function RunCompletionEmail(props: RunCompletionEmailProps) {
  const copy = STATUS_COPY[props.status];
  const badgeColor = COLORS[copy.tone];
  const shortId = props.runId.slice(0, 8);
  const subjectish = `${copy.headline} · ${shortId}`;
  const duration = formatDuration(props.durationMs);

  return (
    <Html lang="en">
      <Head />
      <Preview>{subjectish}</Preview>
      <Body
        style={{
          backgroundColor: COLORS.bg,
          color: COLORS.text,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          margin: 0,
          padding: "32px 0",
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            backgroundColor: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: "12px",
            padding: "28px 28px 24px 28px",
          }}
        >
          <Section style={{ marginBottom: "20px" }}>
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              border={0}
              width="100%"
              style={{ borderCollapse: "collapse" }}
            >
              <tr>
                <td align="left">
                  <Text
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: COLORS.muted,
                      fontFamily:
                        'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Monaco, monospace',
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: COLORS.accent,
                        marginRight: "8px",
                        verticalAlign: "middle",
                      }}
                    />
                    llm-workbench
                  </Text>
                </td>
                <td align="right">
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      backgroundColor: `${badgeColor}1f`,
                      color: badgeColor,
                      border: `1px solid ${badgeColor}55`,
                      fontSize: "11px",
                      fontFamily:
                        'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Monaco, monospace',
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {copy.badge}
                  </span>
                </td>
              </tr>
            </table>
          </Section>

          <Heading
            as="h1"
            style={{
              margin: "8px 0 4px 0",
              fontSize: "22px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: COLORS.text,
            }}
          >
            {copy.headline}
          </Heading>
          <Text
            style={{
              margin: "0 0 20px 0",
              fontSize: "14px",
              color: COLORS.muted,
              lineHeight: 1.5,
            }}
          >
            {copy.lede}
          </Text>

          <Section
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: "10px",
              padding: "14px 16px",
              backgroundColor: "#0d1017",
            }}
          >
            <SummaryRow label="run" value={shortId} mono fullValue={props.runId} />
            <SummaryRow label="workflow" value={props.workflowId ?? "—"} mono />
            <SummaryRow label="started" value={formatTimestamp(props.startedAt)} />
            <SummaryRow label="ended" value={formatTimestamp(props.endedAt)} />
            <SummaryRow label="duration" value={duration} last />
          </Section>

          <Section style={{ textAlign: "center", padding: "24px 0 8px 0" }}>
            <Button
              href={props.runUrl}
              style={{
                backgroundColor: COLORS.accent,
                color: "#0b0d12",
                padding: "12px 22px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
                boxSizing: "border-box",
              }}
            >
              Open run
            </Button>
          </Section>

          <Hr
            style={{
              borderColor: COLORS.border,
              borderStyle: "solid",
              margin: "24px 0 16px 0",
            }}
          />

          <Text
            style={{
              margin: "0 0 6px 0",
              fontSize: "12px",
              color: COLORS.muted,
              lineHeight: 1.6,
            }}
          >
            You received this because run-completion notifications are enabled
            for your account. Manage notification preferences from the{" "}
            <Link
              href={props.preferencesUrl}
              style={{ color: COLORS.accent, textDecoration: "underline" }}
            >
              playground
            </Link>
            . Per-account toggles are coming soon.
          </Text>
          <Text
            style={{
              margin: "8px 0 0 0",
              fontSize: "11px",
              color: COLORS.muted,
              lineHeight: 1.5,
              fontFamily:
                'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Monaco, monospace',
            }}
          >
            © llm-workbench. PolyForm Noncommercial 1.0.0 reference deployment.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function SummaryRow({
  label,
  value,
  mono,
  last,
  fullValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
  fullValue?: string;
}) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      width="100%"
      style={{
        borderCollapse: "collapse",
        marginBottom: last ? 0 : "8px",
      }}
    >
      <tr>
        <td
          align="left"
          width="32%"
          style={{
            fontSize: "11px",
            color: COLORS.muted,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontFamily:
              'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Monaco, monospace',
            paddingRight: "8px",
            verticalAlign: "top",
          }}
        >
          {label}
        </td>
        <td
          align="left"
          style={{
            fontSize: "13px",
            color: COLORS.text,
            fontFamily: mono
              ? 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Monaco, monospace'
              : undefined,
            wordBreak: "break-all",
          }}
          title={fullValue}
        >
          {value}
        </td>
      </tr>
    </table>
  );
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return `${d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z")}`;
}

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
  const min = Math.floor(totalSec / 60);
  const sec = Math.round(totalSec - min * 60);
  return `${min}m ${sec}s`;
}

RunCompletionEmail.PreviewProps = {
  runId: "8f4a3c2e-1b9d-4d77-8b2e-7c6e0f4a1de2",
  status: "completed",
  workflowId: "job-search-v3",
  startedAt: "2026-04-27T19:55:12.000Z",
  endedAt: "2026-04-27T19:57:48.000Z",
  durationMs: 156000,
  runUrl: "https://workbench.example.com/runs/8f4a3c2e-1b9d-4d77-8b2e-7c6e0f4a1de2",
  preferencesUrl: "https://workbench.example.com/playground",
} satisfies RunCompletionEmailProps;

export default RunCompletionEmail;
