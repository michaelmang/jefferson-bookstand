import * as THREE from "three";

const WIDTH = 512;
const HEIGHT = 672;

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    if (line && ctx.measureText(line + char).width > maxWidth) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines) {
        lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…";
        return lines;
      }
    } else {
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function createPaperTexture(title: string | null): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  if (title) {
    ctx.fillStyle = "#f9f5e9";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "#e3dcc8";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, WIDTH - 6, HEIGHT - 6);

    ctx.fillStyle = "#2b2320";
    ctx.font = "600 36px Georgia, serif";
    ctx.textAlign = "center";
    const lines = wrapLines(ctx, title, WIDTH - 90, 3);
    lines.forEach((line, i) => ctx.fillText(line, WIDTH / 2, 82 + i * 46));

    // Faint rule lines suggesting manuscript text
    ctx.strokeStyle = "#c3b99f";
    ctx.lineWidth = 3;
    for (let y = 250; y < HEIGHT - 56; y += 34) {
      const indent = (y / 34) % 5 === 0 ? 92 : 58;
      ctx.beginPath();
      ctx.moveTo(indent, y);
      ctx.lineTo(WIDTH - 58, y);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#efe9d9";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = "#a89d84";
    ctx.lineWidth = 4;
    ctx.strokeRect(26, 26, WIDTH - 52, HEIGHT - 52);

    ctx.fillStyle = "#8a7f66";
    ctx.textAlign = "center";
    ctx.font = "300 130px Georgia, serif";
    ctx.fillText("+", WIDTH / 2, HEIGHT / 2);
    ctx.font = "28px Georgia, serif";
    ctx.fillText("Assign a PDF", WIDTH / 2, HEIGHT / 2 + 92);
  }

  return textureFromCanvas(canvas);
}

/** Shown while pdf.js is still rasterizing the first page. */
export function createLoadingPaperTexture(title: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#f6f1e2";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "#e3dcc8";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, WIDTH - 6, HEIGHT - 6);

  ctx.fillStyle = "#4a3f30";
  ctx.font = "600 34px Georgia, serif";
  ctx.textAlign = "center";
  const lines = wrapLines(ctx, title, WIDTH - 90, 2);
  lines.forEach((line, i) => ctx.fillText(line, WIDTH / 2, 80 + i * 44));

  ctx.fillStyle = "#8a7f66";
  ctx.font = "italic 30px Georgia, serif";
  ctx.fillText("Rendering the first page", WIDTH / 2, HEIGHT / 2);
  ctx.font = "italic 44px Georgia, serif";
  ctx.fillText("· · ·", WIDTH / 2, HEIGHT / 2 + 56);

  return textureFromCanvas(canvas);
}

export function textureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
