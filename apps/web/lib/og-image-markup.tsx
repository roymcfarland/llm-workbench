/* Shared markup for `next/og` image routes — inline styles only (no Tailwind). */
import { BRIGHTLINE_LABS_NAME, SITE_SHARE_HOST } from "@/lib/site";

export function OgImageMarkup() {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#09090b",
        backgroundImage:
          "radial-gradient(circle at 18% 22%, rgba(34, 211, 238, 0.22), transparent 42%), radial-gradient(circle at 82% 18%, rgba(167, 139, 250, 0.24), transparent 38%), radial-gradient(circle at 50% 100%, rgba(244, 114, 182, 0.12), transparent 48%)",
        padding: 64,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)",
              boxShadow: "0 0 28px rgba(34, 211, 238, 0.55)",
            }}
          />
          <span
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#fafafa",
              letterSpacing: "-0.035em",
            }}
          >
            LLM Workbench
          </span>
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#fafafa",
            lineHeight: 1.08,
            letterSpacing: "-0.04em",
            maxWidth: 980,
          }}
        >
          Ship agents you can debug, fork, and replay.
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 26,
            color: "rgba(250, 250, 250, 0.55)",
            maxWidth: 860,
            lineHeight: 1.38,
            fontWeight: 500,
          }}
        >
          Tamper-evident run bundles · Human gates · MCP & OpenAPI
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          marginTop: 32,
          paddingTop: 28,
          borderTop: "1px solid rgba(250, 250, 250, 0.12)",
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "rgba(250, 250, 250, 0.45)",
            letterSpacing: "0.02em",
          }}
        >
          {SITE_SHARE_HOST}
        </span>
        <span
          style={{
            fontSize: 19,
            fontWeight: 500,
            color: "rgba(250, 250, 250, 0.4)",
          }}
        >
          Attributed to {BRIGHTLINE_LABS_NAME}
        </span>
      </div>
    </div>
  );
}
