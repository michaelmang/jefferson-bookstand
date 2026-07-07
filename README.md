# Jefferson's Revolving Bookstand

A 3D recreation of Thomas Jefferson's revolving bookstand (the one at Monticello) where each
of the five rests holds a PDF instead of a book. Built with Next.js, React, TypeScript,
Three.js, and React Three Fiber.

## The idea

Jefferson's stand let him keep five books open at once — but only the one facing him was
readable; he had to spin the stand to consult another. This app enforces the same constraint:

- **Assign** a PDF to any of the five rests (click an empty rest, or use the side panel).
  The PDF's first page is rendered onto the paper via pdf.js.
- **Read** by clicking the paper on the rest facing you — it opens in a full-screen reader.
- **Spin** the stand to reach the other papers: drag it horizontally, use the ◀ ▶ buttons,
  or the left/right arrow keys. Clicking a paper that isn't facing you politely refuses.
- The **top rest** (Rest V), like the real one, is readable from any angle.

PDFs are held in memory as object URLs — nothing is uploaded, and assignments reset on reload.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                 | What it does                     |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the dev server             |
| `npm run build`        | Production build                 |
| `npm run start`        | Serve the production build       |
| `npm run lint`         | ESLint (Next + TypeScript rules) |
| `npm run format`       | Prettier, write mode             |
| `npm run format:check` | Prettier, check mode             |

## How it's put together

- `components/BookstandApp.tsx` — slot state, HUD, file input, reader overlay wiring.
- `components/BookstandScene.tsx` — the R3F `<Canvas>`, camera, and lights.
- `components/Bookstand.tsx` — the stand geometry plus the spin mechanics: drag-to-rotate
  with snap-to-quarter-turn, and the math deciding which rest currently faces the camera.
- `components/BookRest.tsx` — one rest (board, ledge, paper) with hover/click handling.
- `lib/paperTexture.ts` — draws each paper (title + manuscript rules, or an "Assign a PDF"
  placeholder) onto a canvas used as a Three.js texture.
- `lib/pdfPreview.ts` — rasterizes a PDF's first page with pdf.js for the 3D paper. The
  pdf.js worker is copied into `public/` by the `postinstall` script.
- `components/PdfReaderOverlay.tsx` — full-screen reader using the browser's native PDF
  viewer in an iframe.
