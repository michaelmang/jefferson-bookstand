"use client";

import { useEffect, useRef } from "react";

export type LensInfo = {
  /** Cursor position in viewport pixels. */
  x: number;
  y: number;
  /** Texture coordinates on the paper (0..1, v up). */
  u: number;
  v: number;
  /** The rendered page the lens magnifies. */
  canvas: HTMLCanvasElement;
};

const LENS_SIZE = 220;
const ZOOM_FRACTION = 3.2; // lens shows 1/3.2 of the paper's width

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A round reading glass that follows the cursor over the facing paper. */
export default function MagnifierLens({ lens }: { lens: LensInfo | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!lens) return;
    const target = canvasRef.current?.getContext("2d");
    if (!target) return;
    const { canvas, u, v } = lens;
    const side = canvas.width / ZOOM_FRACTION;
    const sx = clamp(u * canvas.width - side / 2, 0, Math.max(0, canvas.width - side));
    const sy = clamp((1 - v) * canvas.height - side / 2, 0, Math.max(0, canvas.height - side));
    target.fillStyle = "#f7f1e3";
    target.fillRect(0, 0, LENS_SIZE, LENS_SIZE);
    target.drawImage(canvas, sx, sy, side, side, 0, 0, LENS_SIZE, LENS_SIZE);
  }, [lens]);

  if (!lens) return null;
  return (
    <div className="lens" style={{ left: lens.x, top: lens.y }} aria-hidden>
      <canvas ref={canvasRef} width={LENS_SIZE} height={LENS_SIZE} />
    </div>
  );
}
