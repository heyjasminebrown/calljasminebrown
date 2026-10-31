import { ImageResponse } from "next/og";
import { OWNER_NAME, OWNER_FIRST_NAME } from "@/lib/brand/identity";

export const runtime = "edge";
export const alt = `Book time with ${OWNER_NAME}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f4f1f5 0%, #ffffff 70%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 88,
            height: 88,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 24,
            background: "#291a2e",
            fontSize: 44,
            marginBottom: 32,
          }}
        >
          📅
        </div>
        <div style={{ fontSize: 60, fontWeight: 700, color: "#1c1917" }}>Chat with {OWNER_FIRST_NAME}</div>
        <div style={{ fontSize: 30, color: "#78716c", marginTop: 18 }}>Pick a time that works for you</div>
      </div>
    ),
    { ...size },
  );
}
