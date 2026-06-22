# Voidship Forge — Frontend Prototype

A runnable implementation of the **custom-authoring paradigm**: the user authors *every* building block (hull, components, histories, machine spirits, abilities, traits, achievements), and the only fixed thing is the closed **Attribute Registry** that effects bind to. A ship is a computation, not a document — the Summary View is always re-derived from the sheet.

Ships are saved as JSON files on disk (no database, no accounts). Anyone with a link can open, edit, and save.

## Run it

```bash
npm install
npm run dev
```

This starts **two processes**:
- Vite dev server at http://localhost:5173 (UI + HMR)
- File API at http://localhost:3001 (proxied via `/api`)

Open http://localhost:5173 — you'll be redirected to a new ship at `/s/<id>`.

### Production

```bash
npm run build
npm start
```

Serves the built app and API together on http://localhost:3000 (override with `PORT`).

```bash
npm run typecheck  # tsc --noEmit
```

## Sharing & saving

| Action | How |
|--------|-----|
| **New ship** | Visit `/` or click **New ship** in the toolbar |
| **Save** | Click **Save** — writes the current sheet to `ships/<id>.json` |
| **Share** | Click **Copy link** — anyone with `/s/<id>` can open and edit |
| **Play mode** | Toggle **Play** for a read-only ship sheet view |

- No login required — the link *is* the access key.
- Last save wins if two people edit the same link concurrently.
- **Blank** / **Reset demo** change the local sheet only until you click **Save**.

## What's implemented

- **Pure Resolution Engine** (`src/engine/`) — `compute(sheet, registry) → { summary, diagnostics, trace }`, deterministic phase-ordered fold for all six attribute kinds (CAPACITY, POOL, SCALAR, CATEGORICAL, SLOTSET, LIST). Zero dependencies; the same function a backend would import.
- **Flat-file persistence** (`server/index.js`) — `POST/GET/PUT /api/ships/:id`, one JSON file per ship in `ships/`.
- **The one picklist** — every effect points at a Registry attribute; the UI only offers ops legal for that attribute's kind.
- **Live Summary View** — one renderer per kind (capacity bars + spare, pool meters, scalars, creed chip, weapon slots, provenance lists), recomputed on every edit.
- **Play mode** — read-only summary view for at-the-table use.
- **Breakdown inspector** — click any summary panel to see the ordered binding trace ("why is Morale 92?").
- **Diagnostics** — negative/tight spare, ship-points exhausted, slot overflow, no power generator, crew shares ≠ 100%.
- **Undo / redo**, per-element enable/disable, drag-to-reorder, all seven element types sharing one authoring form.

## Project structure

```
api/           Vercel serverless routes (Blob storage in production)
lib/           shared ship validation + Blob helpers
server/        local dev file API — ships saved as JSON in ships/
src/
  api/         fetch helpers for ship CRUD
  engine/      types · registry (closed vocabulary) · compute (the fold)
  store/       builderStore — Zustand + Immer, undo/redo, dirty/save state
  data/        seed sheet (§1.5 worked example) + blank sheet
  pages/       HomePage (create ship) · ShipPage (load + edit)
  components/  ShipEditor · ElementPalette · BuilderCanvas · SummaryView
               PropertyInspector · EffectRow · BreakdownInspector
ships/         persisted ship JSON files (gitignored)
```

## Engine verification

The engine is checked against the §1.5 worked example (Power 45/1→44 spare, Morale max 92 after Haunted/Cathedral/Class-Division, conditional Piloting surfaced as a skill mod rather than folded, etc.). All checks pass.

## Not in this prototype (deferred to full build)

Postgres/JSONB persistence + versioning, authoritative server recompute, the personal Library, publish/render to CDN, and auth/multi-tenancy — all described in the Implementation Playbook.

## Deploy to Vercel

The app is configured for [Vercel](https://vercel.com) with [Vercel Blob](https://vercel.com/docs/vercel-blob) storage (no database).

### Steps

1. Push this repo to GitHub ([kolahti/Rogue-Trader](https://github.com/kolahti/Rogue-Trader))
2. In Vercel: **Add New Project** → import the repo
3. Framework preset: **Vite** (auto-detected from `vercel.json`)
4. In the project: **Storage** → **Connect Store** → **Blob**
5. Deploy — Vercel injects `BLOB_READ_WRITE_TOKEN` automatically

### How it works on Vercel

| Environment | Storage | API |
|-------------|---------|-----|
| **Local dev** (`npm run dev`) | `ships/*.json` on disk | `server/index.js` on :3001 |
| **Vercel** | Blob files at `ships/<id>.json` | Serverless functions in `api/ships/` |

Share links work the same: `https://your-app.vercel.app/s/ship_abc123`

### Local dev with Blob (optional)

To test Blob storage locally, pull env vars from Vercel:

```bash
npx vercel env pull .env.local
```

Then run the Vercel dev server instead of the file API:

```bash
npx vercel dev
```

Without Blob credentials, local `npm run dev` continues to use the file-based API in `server/`.

