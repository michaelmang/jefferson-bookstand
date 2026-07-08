import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Same wax-seal mark as icon.tsx, scaled up with Apple's recommended padding. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3ecd9",
      }}
    >
      <div
        style={{
          width: "84%",
          height: "84%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 35% 30%, #b8392f, #7a2019)",
          borderRadius: "50%",
        }}
      >
        <div
          style={{
            width: "44%",
            height: "44%",
            background: "#f3ecd9",
            transform: "rotate(45deg)",
            display: "flex",
          }}
        />
      </div>
    </div>,
    { ...size },
  );
}
