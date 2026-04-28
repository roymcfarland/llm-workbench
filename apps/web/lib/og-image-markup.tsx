/* Shared markup for `next/og` image routes — inline styles only (no Tailwind). */
export function OgImageMarkup() {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        backgroundColor: "#09090b",
        backgroundImage:
          "radial-gradient(circle at 18% 22%, rgba(34, 211, 238, 0.22), transparent 42%), radial-gradient(circle at 82% 18%, rgba(167, 139, 250, 0.24), transparent 38%), radial-gradient(circle at 50% 100%, rgba(244, 114, 182, 0.12), transparent 48%)",
        padding: 72,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
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
          fontSize: 58,
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
          marginTop: 26,
          fontSize: 27,
          color: "rgba(250, 250, 250, 0.55)",
          maxWidth: 860,
          lineHeight: 1.38,
          fontWeight: 500,
        }}
      >
        Tamper-evident run bundles · Human gates · MCP & OpenAPI
      </div>
    </div>
  );
}
