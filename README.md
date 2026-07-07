# Jefferson's Revolving Bookstand

A 3D recreation of Thomas Jefferson's revolving bookstand (the one at Monticello) where each
of the five rests holds a PDF instead of a book — now with a small society of curators around
it. Built with Next.js, React, TypeScript, Three.js, React Three Fiber, and SQLite.

## The idea

Jefferson's stand let him keep five books open at once — but only the one facing him was
readable; he had to spin the stand to consult another. This app enforces the same constraint:

- **Assign** a PDF to any of the five rests (click an empty rest, or use the side panel).
  The PDF's first page is rendered onto the paper via pdf.js.
- **Read** by clicking the paper on the rest facing you — it opens in a full-screen reader.
- **Spin** the stand to reach the other papers: drag and fling it, use the ◀ ▶ buttons, or
  the left/right arrow keys. The stand has real spin physics — momentum, friction, and a
  détente that captures it square at each rest, with a wooden click as rests clack past.
- The **top rest** (Rest V), like the real one, is readable from any angle.
- **Magnifying glass** (🔍 or `m`): hover the facing paper to read it through a round lens.
- **Hide controls** (◻ or `h`): clears the HUD so only the stand and the room remain.

## The society

- **Sign in with Google** (or, in development, with just a name) to enter.
- The **home page** is a feed of stands posted today plus the most treasured of the week.
- **Post** a stand from the studio: its five papers, the room you chose, and the study's
  sound settings travel with it.
- **Stamp** a stand you treasure (a wax-seal like), or stamp an individual rest on it.
- **Write a letter** — a short note to the stand's curator, shown on the stand's page.
- **My stands** is your full posting history — searchable and paginated — so a stand stays
  reachable after it leaves the daily feed.
- **Windows and live rooms**: someone else's stand is a window — spin it, read, stamp,
  write a letter; empty rests are bare wood and the study plays exactly as the curator
  left it. Your own stand is a live room — re-paper or clear any rest, load a saved set,
  change the room and sound (all persisted to the post), snapshot the current curation
  into your saved stands, read the letters written to you, or take the stand down.
- The home and landing pages hang public-domain paintings (Rembrandt, Vermeer) hotlinked
  from Wikimedia Commons.

## The study

- **The Room**: five backgrounds (Monticello library, candlelit study, dawn, evening,
  garden) — part of the stand's shareable state.
- **Radio**: four streaming classical stations with volume control.
- **Open window**: a synthesized ambience — pink-noise breeze with gusts that stir a
  correlated leaf rustle, and birds (whistles, trills, chips, warbles) calling at varying
  distances, all passed through a generated small-room convolution reverb. No audio assets.
- **Wood clicks**: the détente click is modal synthesis — a contact tick, inharmonic wood
  body partials, and a low knock, randomly detuned per click.

## Saved stands

One workbench, one ledger. The Saved Stands section — identical in the studio and on your
own posted stands — is where curations live: save the current one under a name (papers,
room, and sound go with it, into your browser's IndexedDB), search and page through your
history, load one back onto the stand, and publish or unpublish it on the home page.
Badges mark which save is on the stand and which are published; the posted title is the
save's name. Opening one of your posted stands is just this same workbench with that
stand loaded.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Sign-in works out of the box in development (name-only dev login). For real Google sign-in,
create an OAuth **Web** client in Google Cloud Console and set:

```bash
# .env.local
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
AUTH_SECRET=a-long-random-string   # session-cookie signing key (required in production)
```

Posted stands live in `data/` (SQLite + uploaded PDFs), which is gitignored.

## Deploying (Vercel)

Pushes to `main` auto-deploy via Vercel's GitHub integration. Vercel's filesystem is
ephemeral, so production storage is external; locally everything falls back to `data/`:

| Env var                        | What it does                                                            |
| ------------------------------ | ----------------------------------------------------------------------- |
| `DATABASE_URL`                 | libSQL URL. Unset → local `data/bookstand.db`. Prod: a [Turso](https://turso.tech) DB (`libsql://…`) |
| `DATABASE_AUTH_TOKEN`          | Turso auth token                                                        |
| `BLOB_READ_WRITE_TOKEN`        | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) token; unset → PDFs on local disk |
| `AUTH_SECRET`                  | Session-cookie signing key (required in production)                     |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Web client ID (unset → dev name-login, disabled in prod)   |

One-time setup: create a Turso database (`turso db create jefferson-bookstand`, then
`turso db show --url` / `turso db tokens create`), add a Blob store to the Vercel project
(Storage tab — this injects `BLOB_READ_WRITE_TOKEN` automatically), and set the variables
in the Vercel project settings. The schema creates itself on first request.

> **Caveat**: Vercel serverless requests cap bodies at ~4.5 MB, so PDFs posted in
> production must be modest until uploads move to client→Blob direct uploads.

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

- `app/page.tsx` — the home feed (server component): today's stands, weekly most treasured.
- `app/mine/page.tsx` — your posting history with search and pagination.
- `app/studio/page.tsx` — the 3D studio where you build and post your stand.
- `app/stand/[id]/page.tsx` — a posted stand: spin it, read it, stamp it, write letters.
  Curators get the owner view: stamps received, letters to you, and takedown.
- `app/actions.ts` — server actions: post stand, stamp stand/rest, write letter, sign out.
- `app/api/auth/*` — Google Identity Services token verification (+ dev-only name login).
- `app/api/files/[...path]` — serves uploaded PDFs to signed-in readers.
- `lib/server/` — SQLite schema (`db.ts`), session JWTs (`auth.ts`), feed queries
  (`feed.ts`), upload handling (`uploads.ts`).
- `lib/standState.ts` — the shareable stand state: room backgrounds + audio settings.
- `components/BookstandApp.tsx` — studio state: slots, saved stands, room, posting, HUD.
- `components/StandViewer.tsx` — a posted stand with stamps and letters.
- `components/BookstandScene.tsx` / `Bookstand.tsx` / `BookRest.tsx` — the R3F scene,
  spin physics (détente capture tuned by simulation), and each rest's board/paper.
- `components/MagnifierLens.tsx` — the reading glass; papers report texture UVs on hover.
- `lib/audio.ts` — Web Audio synthesis: modal wood clicks, wind/rustle/birds, reverb.
- `lib/standsStore.ts` — IndexedDB persistence for named stands (PDF bytes included).
- `lib/pdfPreview.ts` — rasterizes a PDF's first page with pdf.js for the 3D paper.
