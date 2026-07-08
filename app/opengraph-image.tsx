import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "Jefferson's Revolving Bookstand — a reading society";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFonts() {
  const dir = path.join(process.cwd(), "assets");
  const [bold, regular] = await Promise.all([
    readFile(path.join(dir, "PTSerif-Bold.ttf")),
    readFile(path.join(dir, "PTSerif-Regular.ttf")),
  ]);
  return [
    { name: "PT Serif", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "PT Serif", data: regular, weight: 400 as const, style: "normal" as const },
  ];
}

export default async function Image() {
  const fonts = await loadFonts();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 30% 20%, #3a2c1c 0%, #1c150d 65%)",
        fontFamily: "PT Serif",
      }}
    >
      {/* Wax-seal mark */}
      <div
        style={{
          width: 96,
          height: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 35% 30%, #b8392f, #7a2019)",
          borderRadius: "50%",
          marginBottom: 36,
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

      <div
        style={{
          fontSize: 22,
          letterSpacing: 10,
          color: "#c9a876",
          marginBottom: 18,
          display: "flex",
        }}
      >
        A READING SOCIETY
      </div>

      <div
        style={{
          fontSize: 76,
          fontWeight: 700,
          color: "#f7f1e3",
          textAlign: "center",
          lineHeight: 1.1,
          display: "flex",
          padding: "0 60px",
        }}
      >
        Jefferson&apos;s Revolving Bookstand
      </div>

      <div
        style={{
          fontSize: 28,
          color: "#c9bfa8",
          marginTop: 30,
          textAlign: "center",
          display: "flex",
          padding: "0 140px",
        }}
      >
        Curate five papers on a spinning bookstand, and share it with a reading society
      </div>
    </div>,
    { ...size, fonts },
  );
}
