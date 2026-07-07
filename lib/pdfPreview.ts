import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export const PREVIEW_WIDTH = 768;
export const PREVIEW_HEIGHT = 1014;

/**
 * Rasterizes the first page of a PDF onto a paper-sized canvas
 * (contain-fit, centered). Returns null if the PDF can't be rendered.
 */
export async function renderPdfPreview(data: ArrayBuffer): Promise<HTMLCanvasElement | null> {
  try {
    const loadingTask = getDocument({ data });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(PREVIEW_WIDTH / base.width, PREVIEW_HEIGHT / base.height);
    const viewport = page.getViewport({ scale });

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = Math.ceil(viewport.width);
    pageCanvas.height = Math.ceil(viewport.height);
    await page.render({ canvas: pageCanvas, viewport }).promise;
    await loadingTask.destroy();

    const canvas = document.createElement("canvas");
    canvas.width = PREVIEW_WIDTH;
    canvas.height = PREVIEW_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f9f5e9";
    ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    ctx.drawImage(
      pageCanvas,
      (PREVIEW_WIDTH - pageCanvas.width) / 2,
      (PREVIEW_HEIGHT - pageCanvas.height) / 2,
    );
    return canvas;
  } catch {
    return null;
  }
}
