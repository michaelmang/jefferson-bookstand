import * as THREE from "three";

export type WoodVariant = "body" | "board" | "trim" | "dark";

type Palette = {
  base: string;
  dark: string;
  mid: string;
  light: string;
  /** Rotate the grain 90° (for tall boards where grain runs upward). */
  vertical: boolean;
  seed: number;
};

const PALETTES: Record<WoodVariant, Palette> = {
  body: {
    base: "#7a5128",
    dark: "#452a10",
    mid: "#5e3c1a",
    light: "#96683a",
    vertical: false,
    seed: 11,
  },
  board: {
    base: "#5c3c1d",
    dark: "#33200c",
    mid: "#452a11",
    light: "#75502b",
    vertical: true,
    seed: 29,
  },
  trim: {
    base: "#63401f",
    dark: "#38220d",
    mid: "#4c2f14",
    light: "#7d552d",
    vertical: false,
    seed: 47,
  },
  dark: {
    base: "#452b14",
    dark: "#241505",
    mid: "#33200c",
    light: "#5c3d20",
    vertical: false,
    seed: 73,
  },
};

// Deterministic PRNG so every render (and every rest) gets the same grain.
function mulberry32(seed: number) {
  let state = seed;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawWood(size: number, palette: Palette): HTMLCanvasElement {
  const { base, dark, mid, light, seed } = palette;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(seed);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Broad tonal bands, like adjacent growth regions
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.04 + rand() * 0.05;
    ctx.fillStyle = rand() > 0.5 ? light : mid;
    ctx.fillRect(0, rand() * size, size, 24 + rand() * 70);
  }

  // Long wavy grain lines
  for (let i = 0; i < 160; i++) {
    const y0 = rand() * size;
    const amp = 1.5 + rand() * 5;
    const period = 90 + rand() * 220;
    const phase = rand() * Math.PI * 2;
    ctx.globalAlpha = 0.06 + rand() * 0.13;
    ctx.strokeStyle = [dark, mid, light][Math.floor(rand() * 3)];
    ctx.lineWidth = 0.6 + rand() * 1.8;
    ctx.beginPath();
    for (let x = -8; x <= size + 8; x += 14) {
      const y =
        y0 + Math.sin(phase + (x / period) * Math.PI * 2) * amp + Math.sin(x * 0.05 + phase * 2);
      if (x === -8) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // A few knots: concentric rings with a dark heart
  const knots = 2 + Math.floor(rand() * 2);
  for (let k = 0; k < knots; k++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const tilt = rand() * 0.6;
    const rings = 5 + Math.floor(rand() * 3);
    for (let r = 1; r <= rings; r++) {
      ctx.globalAlpha = 0.05 + 0.1 * (1 - r / rings);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1 + rand();
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * (3 + rand() * 3), r * (2 + rand() * 2), tilt, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 3.5, 2.2, tilt, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine speckle so flat faces don't look synthetic
  for (let i = 0; i < 900; i++) {
    ctx.globalAlpha = 0.03 + rand() * 0.04;
    ctx.fillStyle = rand() > 0.5 ? dark : light;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1);
  }

  ctx.globalAlpha = 1;
  return canvas;
}

const cache = new Map<WoodVariant, THREE.CanvasTexture>();

export function getWoodTexture(variant: WoodVariant): THREE.CanvasTexture {
  const cached = cache.get(variant);
  if (cached) return cached;
  const palette = PALETTES[variant];
  const texture = new THREE.CanvasTexture(drawWood(512, palette));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (palette.vertical) {
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI / 2;
  }
  cache.set(variant, texture);
  return texture;
}
