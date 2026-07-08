import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getStandDetail } from "@/lib/server/feed";

export const alt = "A curated bookstand";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The room backgrounds' actual CSS (lib/standState.ts) either references a
 * local photo or a gradient; the photo can't resolve inside satori's
 * rendering context, so this mirrors each room's mood with a gradient only.
 */
const OG_ROOM_BACKGROUND: Record<string, string> = {
  library: "radial-gradient(circle at 30% 20%, #4a3416 0%, #241a0c 65%)",
  candlelight: "radial-gradient(circle at 32% 24%, #6b4a20 0%, #17100a 72%)",
  dawn: "linear-gradient(178deg, #6b5a3c 0%, #4a3d28 40%, #241d12 100%)",
  evening: "linear-gradient(180deg, #3a4666 0%, #1c2438 100%)",
  garden: "linear-gradient(180deg, #4d5c40 0%, #263420 100%)",
};

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

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [fonts, detail] = await Promise.all([loadFonts(), getStandDetail(Number(id), null)]);

  const title = detail?.title ?? "A Curated Bookstand";
  const curator = detail?.author.name ?? null;
  const restCount = detail?.slots.filter(Boolean).length ?? 0;
  const background = OG_ROOM_BACKGROUND[detail?.background ?? "library"];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        background,
        fontFamily: "PT Serif",
        padding: "0 100px",
      }}
    >
      <div
        style={{
          fontSize: 20,
          letterSpacing: 8,
          color: "#c9a876",
          marginBottom: 22,
          display: "flex",
        }}
      >
        JEFFERSON&apos;S REVOLVING BOOKSTAND
      </div>

      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: "#f7f1e3",
          lineHeight: 1.15,
          display: "flex",
          maxWidth: 980,
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 34,
          fontSize: 26,
          color: "#d9cfb8",
        }}
      >
        {curator && <div style={{ display: "flex" }}>Curated by {curator}</div>}
        {curator && (
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#8a7f66",
              margin: "0 18px",
              display: "flex",
            }}
          />
        )}
        <div style={{ display: "flex" }}>
          {restCount} {restCount === 1 ? "paper" : "papers"} resting
        </div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
