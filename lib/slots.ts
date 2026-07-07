/** The five rests, shared by client components and server actions. */
export const SLOT_LABELS = ["Rest I", "Rest II", "Rest III", "Rest IV", "Rest V (top)"];
export const SLOT_COUNT = SLOT_LABELS.length;
export const TOP_SLOT = 4;

/** What the 3D scene needs to draw one rest. */
export type SlotView = {
  name: string;
  url: string;
  preview: HTMLCanvasElement | null;
  /** True while pdf.js is still rasterizing the first page. */
  previewPending: boolean;
} | null;
