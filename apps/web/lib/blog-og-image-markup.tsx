/* Blog share cards for `next/og` routes — inline styles only (no Tailwind). */
import {
  BRIGHTLINE_LABS_NAME,
  SITE_SHARE_HOST,
  SITE_NAME,
} from "@/lib/site";

function truncateWords(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  const slice = t.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut =
    lastSpace > Math.floor(maxChars * 0.55) ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

export type BlogOgImageMarkupProps =
  | {
      variant: "index";
      /** Primary headline */
      headline: string;
      /** Supporting line */
      subhead: string;
    }
  | {
      variant: "post";
      title: string;
      description: string;
      /** e.g. "Apr 28, 2026 · Author" */
      metaLine: string;
    };

export function BlogOgImageMarkup(props: BlogOgImageMarkupProps) {
  const titleFontSize =
    props.variant === "post"
      ? props.title.length > 72
        ? 38
        : props.title.length > 46
          ? 44
          : 52
      : 52;

  const desc =
    props.variant === "post"
      ? truncateWords(props.description, 148)
      : truncateWords(props.subhead, 152);

  const headline =
    props.variant === "post"
      ? truncateWords(props.title, 118)
      : truncateWords(props.headline, 108);

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#09090b",
        backgroundImage:
          "radial-gradient(circle at 14% 20%, rgba(34, 211, 238, 0.2), transparent 44%), radial-gradient(circle at 88% 16%, rgba(167, 139, 250, 0.22), transparent 40%), radial-gradient(circle at 48% 96%, rgba(244, 114, 182, 0.1), transparent 52%)",
        padding: 56,
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
            marginBottom: 22,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)",
              boxShadow: "0 0 26px rgba(34, 211, 238, 0.5)",
            }}
          />
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#fafafa",
              letterSpacing: "-0.02em",
            }}
          >
            {SITE_NAME}
          </span>
          <span
            style={{
              marginLeft: 4,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(250, 250, 250, 0.45)",
            }}
          >
            Blog
          </span>
        </div>

        <div
          style={{
            fontSize: titleFontSize,
            fontWeight: 700,
            color: "#fafafa",
            lineHeight: 1.12,
            letterSpacing: "-0.038em",
            maxWidth: 1040,
          }}
        >
          {headline}
        </div>

        <div
          style={{
            marginTop: 22,
            fontSize: 26,
            color: "rgba(250, 250, 250, 0.55)",
            maxWidth: 920,
            lineHeight: 1.42,
            fontWeight: 500,
          }}
        >
          {desc}
        </div>

        {props.variant === "post" ? (
          <div
            style={{
              marginTop: 26,
              fontSize: 20,
              fontWeight: 600,
              color: "rgba(250, 250, 250, 0.42)",
              letterSpacing: "0.01em",
            }}
          >
            {props.metaLine}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          marginTop: 28,
          paddingTop: 26,
          borderTop: "1px solid rgba(250, 250, 250, 0.12)",
        }}
      >
        <span
          style={{
            fontSize: 19,
            fontWeight: 600,
            color: "rgba(250, 250, 250, 0.45)",
            letterSpacing: "0.02em",
          }}
        >
          {SITE_SHARE_HOST}
          {props.variant === "index" ? "/blog" : ""}
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "rgba(250, 250, 250, 0.38)",
          }}
        >
          Attributed to {BRIGHTLINE_LABS_NAME}
        </span>
      </div>
    </div>
  );
}
