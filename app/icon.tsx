import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * A wax-seal mark — the same red/cream palette as the "stamp" treasuring a
 * stand elsewhere in the app, with a diamond standing in for a single
 * resting leaf. Pure CSS shapes (no glyphs, no fonts) so it renders
 * identically at every size from a browser tab up to a home-screen icon.
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
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
    </div>,
    { ...size },
  );
}
