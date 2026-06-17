import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
        }}
      >
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: 999,
            background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)",
            boxShadow: "0 0 60px rgba(34, 211, 238, 0.5)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
