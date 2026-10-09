import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{
      display: "flex", width: "100%", height: "100%", alignItems: "center",
      justifyContent: "center", background: "#171717", borderRadius: 36,
    }}>
      <div style={{
        display: "flex", width: 132, height: 116, borderRadius: 22,
        background: "#facc15", color: "#171717", alignItems: "center",
        justifyContent: "center", fontSize: 40, fontWeight: 900,
      }}>MS</div>
    </div>,
    size
  );
}
