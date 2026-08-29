# Voidship Forge — Implementation Playbook (Custom-Authoring Paradigm)

> Companion to *Voidship Forge — Technical Architecture Document (Custom-Authoring Paradigm)*.
> This playbook turns that blueprint into an actionable build plan: stack, creator workflow, state model, code structure, and a phased roadmap. The guiding invariant throughout — **a ship is a computation, not a document** — drives nearly every decision below.

---

## 1. Recommended Tech Stack

The architecture has one unusual property that should dictate the whole stack: **there is no node graph**. Bindings never reference other bindings (§5.1), so this is *not* a flow-editor like a visual scripting tool. It is a **form-authoring studio** — a list of Elements, each Element a form with repeatable "Add Effect" rows, feeding a single live Summary View. That distinction kills some popular-but-wrong choices (React Flow, a graph database) and points us at a leaner stack.

### Frontend

| Concern | Choice | Why it fits this blueprint |
|---|---|---|
| Framework | **React 18 + TypeScript + Vite** | The Element/Binding/Attribute shapes are first-class TS types shared with the backend; Vite gives sub-second HMR which matters when iterating on a builder. |
| Authoring drag/reorder | **dnd-kit** (not React Flow) | We only need to reorder Elements and drag Library snippets onto the sheet — a sortable list, not a graph canvas. dnd-kit is lightweight, accessible, and headless. |
| Builder state | **Zustand + Immer** | Single transient store for the in-progress sheet; Immer gives ergonomic immutable updates and — critically — **patch/inverse-patch pairs that become undo/redo for free** (see §3). |
| Server state / data fetching | **TanStack Query** | Clean separation between *builder draft state* (Zustand) and *persisted server state* (Query cache): autosave, version history, library reads. |
| Forms & validation | **React Hook Form + Zod** | Zod schemas are the single validation source, shared with the backend and with the engine's input guard. The one picklist (Attribute Registry) and its kind-dependent op list drive conditional form fields. |
| Styling / UI | **Tailwind CSS + shadcn/ui (Radix)** | Accessible primitives (dropdowns, popovers, dialogs) for the inspector and the Registry picklist; fast to theme into the grim Gothic aesthetic later. |
| Tables / summary panels | Hand-rolled components | The Summary View is bespoke (capacity bars, pool meters, slot grids); a data-grid library would fight us. |

### Shared core — the Resolution Engine

The single most important package. Per the blueprint (§2.1, §4a) the engine is **one pure function `f(sheet, registry) → { summary, diagnostics, trace }`** compiled to two targets.

- **`@voidship/engine`** — a framework-agnostic **TypeScript** package in a monorepo, zero runtime deps, no I/O, fully deterministic. Imported directly by the React app (instant client recompute) and by the backend (authoritative recompute). Because both import the *same* compiled code, steps 2 and 4 of the data lifecycle provably agree.
- Ship it as plain TS first. The blueprint mentions WASM as an option — defer that. A linear fold over bindings is already <1 ms for realistic sheets (§5.1); reach for **Rust→WASM** only if profiling on pathological sheets (thousands of bindings) ever justifies it. Don't pay the WASM toolchain tax up front.
- The Attribute Registry ships as a **static JSON asset baked into this package**, versioned with it. That makes the engine's second input a tiny constant, not a network dependency.

### Backend

| Concern | Choice | Why |
|---|---|---|
| Runtime | **Node.js 20 + TypeScript** | Lets the backend import `@voidship/engine` verbatim — no logic re-implementation, no drift between client and server math. This is the decisive reason to keep the backend in TS. |
| API layer | **tRPC** (REST/OpenAPI facade for publish/CDN routes) | End-to-end type safety from DB → engine → client for the authoring/compute/library routes. Expose the **stateless `POST /v1/compute`** and the **public published-asset** routes as plain REST so they're cacheable and externally consumable. |
| Web framework | **Fastify** | Fast, good for the stateless compute/render workers behind a queue (§5.4). |
| ORM | **Prisma** | Models the relational core (tenant, project, ship, ship_version, library_element, published_asset) cleanly and gives typed access to the **JSONB `config`** payloads. |
| Background work | **BullMQ on Redis** | Stateless compute and PDF/HTML render jobs (§5.4) scale horizontally as queue workers. |

### Data & infrastructure

- **PostgreSQL** with JSONB for the self-contained `config` and `summary_cache`, plus **row-level security** for multi-tenancy (§5.4).
- **Redis** for the summary cache keyed by `hash(sheet)` (§5.2) and as the BullMQ broker.
- **Object store (S3-compatible) + CDN** for immutable published assets.
- Monorepo via **pnpm workspaces + Turborepo** so `engine`, `web`, `api`, and `shared-types` live together and the engine is consumed without publishing.

### What we deliberately did *not* pick

A graph library (no binding-to-binding edges exist), a graph DB (the data is relational + document, not a network), Redux (Zustand + Immer patches cover undo/redo with far less boilerplate), and a separate validation stack per tier (Zod + the engine's diagnostics are shared everywhere).

---

## 2. UX/UI & Creator Workflow Plan

The creator's mental model must mirror the architecture's central insight: **everything is the same shape** (a named, typed container with effect rows), and **the only fixed thing is which attribute an effect points at**. The UI should make "invent a thing → tick what it affects → watch the summary react" feel like one fluid loop.

### UI layout — three panels

```
┌──────────────┬─────────────────────────────────┬────────────────────────┐
│ LEFT          │ CENTER                          │ RIGHT                  │
│ Element       │ Sheet & Live Summary            │ Contextual Inspector   │
│ Palette +     │                                 │                        │
│ Library       │  ┌───────────────────────────┐  │  Authoring form for    │
│               │  │ HULL panel (base numbers) │  │  the selected Element: │
│ • Hull        │  └───────────────────────────┘  │   name · type ·        │
│ • Component   │  ┌───────────────────────────┐  │   description          │
│ • PastHistory │  │ ELEMENT list (sortable)   │  │   ───────────────────  │
│ • MachineSpirit│ │  □ Reclaimed Plasma Batt. │  │   Effect rows:         │
│ • Ability     │  │  □ Haunted (MachineSpirit)│  │    [Attribute ▾]       │
│ • Trait       │  │  □ Void Cathedral         │  │    [Op ▾] [value]      │
│ • Achievement │  └───────────────────────────┘  │    + Add Effect        │
│               │  ┌───────────────────────────┐  │                        │
│ "Save to      │  │ LIVE SUMMARY VIEW         │  │  (Attribute ▾ is the   │
│  Library" /   │  │  Power 60/49 → 11 spare   │  │   ONE picklist in the  │
│  "Insert from │  │  Space 58/57 → 1 spare ⚠  │  │   whole product)       │
│  Library"     │  │  Morale 106/106 · Creed…  │  │                        │
│               │  │  Abilities · Traits · …   │  │                        │
│               │  └───────────────────────────┘  │                        │
└──────────────┴─────────────────────────────────┴────────────────────────┘
```

The center column is unusual: instead of a canvas you *paint on*, it stacks the **editable Element list** above the **live read-only Summary View**, so cause (the element you just authored) and effect (the number that moved) are visible together. On wide screens the Summary can dock to a fourth always-visible rail; on narrow screens it collapses into a sticky bottom sheet.

### The creator journey, step by step

**Step 1 — Initialize the sheet (the Hull).** A new ship starts empty (`POST /v1/ships`). The first task is the Hull, which is just the Element of type `Hull` whose bindings *seed* base values rather than adjust them. The Hull editor is a structured form of raw numbers: Space total, Ship-Point total, Power total, Population total, Hull Integrity max, Morale max, Speed/Mnv/Detection/Armour/Turret, Crew Rate, Creed label, and the weapon-mount provides. Saving it seeds every attribute (engine phase 1).

**Step 2 — Author Elements.** The user clicks an Element type in the left palette (Component, Past History, Machine Spirit, Ability, Trait, Achievement). The right inspector opens the **identical authoring form** for all of them: name (free text), type/subtype (free text, unvalidated), description, then a repeatable list of **Effect rows**.

**Step 3 — Configure effects (the one picklist).** Inside an Effect row:
1. **Attribute ▾** — the *only* picklist in the product, populated from `GET /v1/registry`.
2. Choosing an attribute reveals **only the ops legal for that attribute's `kind`** (e.g. a SCALAR offers ADD/MULTIPLY/SET; a CATEGORICAL offers SET_CATEGORICAL/SHIFT_CATEGORICAL; a CAPACITY also asks for a `side`).
3. A **value field** typed to the op/kind (number, label dropdown from the categorical scale, or a small `{label, note}` for LIST grants), plus optional scope/condition/note.
4. On save, the binding is appended and the **Summary View recomputes live** — the literal meaning of "effects selected are added to the summary view."

**Step 4 — Read the Summary & explain it.** Each Summary panel renders per its kind: CAPACITY as total/consumed/spare with a bar, POOL as max/current meter, SCALAR as a number, CATEGORICAL as a label, SLOTSET as used/total per mount, LIST as bulleted entries with provenance. Any panel is clickable → opens the **Breakdown Inspector** ("why is Morale 97?") showing the ordered binding trace (`GET /ships/{id}/trace?attribute=morale`). Diagnostics surface inline: warnings (tight spare, Σ crew ≠ 100%) and errors (negative spare, ship points exhausted).

**Step 5 — Reuse (optional Library).** Any authored Element can be **saved to the personal Library**; later it can be **inserted as a copy** into another sheet (`from-library/{libId}`). The UI must signal copy-on-insert clearly — editing the library entry afterward never touches existing ships.

**Step 6 — Preview & Publish.** A what-if mode uses the stateless `POST /v1/compute` / `preview` to answer "what happens to Power spare if I bump this battery to +12?" without saving. **Publish** compiles the summary into an immutable shareable artifact (HTML/PDF/JSON) served from the CDN.

Two micro-interactions are worth getting right early: a per-Element **enable/disable toggle** (disabling the Void Cathedral should visibly drop Morale and free Space/SP), and **conditional-effect chips** (e.g. `+10 Piloting · CONDITIONAL: hazardousCelestial`) so scope is never hidden inside a value.

---

## 3. State Management Strategy

There are three distinct kinds of state, and the cleanest builds keep them strictly separate.

1. **Builder draft state** — the in-progress sheet the user is editing. Lives in **Zustand + Immer**, client-only, the fast path.
2. **Derived state** — `{ summary, diagnostics, trace }`. Never stored directly; always *recomputed* from the draft by `@voidship/engine`. Treating it as derived (not stored) is what guarantees the Summary can't drift from the sheet.
3. **Server state** — persisted versions, library, published assets. Lives in **TanStack Query**.

### Real-time recompute (the fast path)

Every authoring action is a Zustand action that mutates the draft via Immer, then triggers the engine. To keep it instant per §5.1:

- **Pure + memoized engine.** `compute(sheet, registry)` is referentially transparent, so results memoize on `hash(sheet)`.
- **Dirty-attribute incremental fold.** The store keeps an index `attribute → contributing bindings`. Editing one binding marks only its target attribute(s) dirty and re-folds *just those*, an O(bindings-on-that-attribute) operation. No dependency graph is needed because bindings never reference each other.
- **Render granularity.** Summary panels subscribe to their own attribute slice, so a Power edit repaints only the Power panel.

```ts
// conceptual store shape
interface BuilderState {
  sheet: ShipConfig;                 // the self-contained source of truth (draft)
  summary: Summary;                  // derived, recomputed by the engine
  diagnostics: Diagnostic[];         // derived
  dirty: Set<AttributeId>;           // which attributes need re-folding

  upsertElement(el: Element): void;  // each action: Immer mutate → mark dirty → recompute → enqueue autosave
  updateBinding(elId: string, idx: number, patch: Partial<Binding>): void;
  toggleElement(elId: string): void;
  setHullValue(attr: AttributeId, value: number | string): void;
}
```

### History — Undo / Redo

Immer can emit **patches and inverse patches** for every mutation. We capture each authoring action as a `{ patches, inversePatches, label }` entry on an undo stack; redo replays the forward patches. This gives labelled, granular history ("Undo: edit Reclaimed Plasma Battery → power +8") almost for free, and avoids snapshotting the whole sheet on every keystroke.

- **Coalescing:** rapid edits to the same field (typing a number) collapse into one history entry via a short debounce so undo doesn't step character-by-character.
- **Bounded stack:** cap at N entries to bound memory on large sheets.
- After applying any undo/redo patch, mark the touched attributes dirty and recompute — history and the summary stay in lockstep.

### Draft auto-save

- After applying an action locally (optimistic), debounce ~400 ms of idle, then `PATCH /v1/ships/{id}/config` with a **small JSON diff** (the changed element/binding), *not* the rendered numbers (§2.2 step 3).
- The server replays the **same engine**, writes a new immutable `ship_version`, and returns authoritative `{ summary, diagnostics }`. **Server result wins** on any disagreement — the client reconciles silently.
- Surface a save indicator (Saving… / Saved / Offline – will retry). Queue patches while offline and flush on reconnect; TanStack Query mutation retries handle transient failures.

### Validation — three layers, one source of truth

1. **Authoring-time (structural), at the UI.** Zod + the Registry constrain inputs before they ever enter the sheet: `attribute` must be a Registry id, `op` must be legal for that attribute's `kind`, `value` must match the op's expected type, numeric **sanity caps** per attribute (no +10⁹ Power), and **input-size caps** (max elements/bindings/string length) per §5.3. Illegal bindings simply can't be authored.
2. **Compute-time (semantic), in the engine.** The validation pass produces diagnostics from the *summary*, content-agnostically: capacity spare ≥ 0, population.current ≤ total, pools within `0..max`, slots used ≤ total, categorical label within scale, plus soft warnings (tight spare, no power generator authored, Σ crew shares ≠ 100%). These never block editing — they annotate.
3. **Persist-time (authoritative), on the server.** The backend re-runs identical structural + semantic checks before writing a version; it is the final arbiter and the trust boundary. The closed Attribute Registry is the entire sandbox — condition predicates run only through a non-Turing-complete, whitelisted evaluator (no `eval`).

The key discipline: **the same Zod schemas and the same engine run on both client and server**, so validation can never disagree between the optimistic path and the authoritative one.

---

## 4. Component Hierarchy & Code Structure

### Monorepo folder structure

```
voidship-forge/
├─ packages/
│  ├─ engine/                      # @voidship/engine — pure, shared, zero-dep
│  │  ├─ src/
│  │  │  ├─ compute.ts             # f(sheet, registry) → {summary, diagnostics, trace}
│  │  │  ├─ fold/                  # one folder per attribute kind
│  │  │  │  ├─ capacity.ts         # total/consumed/current + spare
│  │  │  │  ├─ pool.ts             # max/current, clamp 0..max
│  │  │  │  ├─ scalar.ts           # adds then multipliers over base
│  │  │  │  ├─ categorical.ts      # SET/SHIFT within scale
│  │  │  │  ├─ slotset.ts          # PROVIDE/OCCUPY per mount
│  │  │  │  └─ list.ts             # GRANT/ADD_SKILL_MOD append w/ provenance
│  │  │  ├─ phases.ts              # seed → init pools → collect → fold → derive → validate
│  │  │  ├─ ops.ts                 # SET→SET_MAX→ADD→MULTIPLY→CLAMP_MIN→clamp order
│  │  │  ├─ validate.ts            # diagnostics (content-agnostic)
│  │  │  ├─ trace.ts               # ordered binding trace per attribute
│  │  │  └─ registry.json          # the closed Attribute Registry (baked in)
│  │  └─ test/                     # golden-master tests incl. the §4a worked example
│  ├─ shared-types/                # Element, Binding, AttributeKind, ShipConfig, Summary (Zod + TS)
│  └─ ui/                          # shared design-system primitives (optional)
├─ apps/
│  ├─ web/                         # React + Vite creator studio
│  │  └─ src/
│  │     ├─ store/                 # Zustand slices + Immer-patch history
│  │     │  ├─ builderStore.ts
│  │     │  ├─ history.ts          # undo/redo via inverse patches
│  │     │  └─ autosave.ts         # debounced PATCH + reconciliation
│  │     ├─ panels/
│  │     │  ├─ ElementPalette.tsx  # LEFT: element types + Library
│  │     │  ├─ BuilderCanvas.tsx   # CENTER: hull + sortable element list
│  │     │  ├─ SummaryView.tsx     # CENTER/RAIL: live per-attribute panels
│  │     │  └─ PropertyInspector.tsx # RIGHT: the authoring form
│  │     ├─ authoring/
│  │     │  ├─ ElementForm.tsx     # name · type · description
│  │     │  ├─ EffectRow.tsx       # Attribute▾ → Op▾ → value (the one picklist)
│  │     │  └─ AttributePicker.tsx
│  │     ├─ summary/               # one renderer per kind
│  │     │  ├─ CapacityPanel.tsx  PoolPanel.tsx  ScalarPanel.tsx
│  │     │  ├─ CategoricalPanel.tsx  SlotSetPanel.tsx  ListPanel.tsx
│  │     │  └─ BreakdownInspector.tsx  # "why is Morale 97?"
│  │     └─ lib/ (trpc client, query hooks)
│  └─ api/                         # Node + Fastify + tRPC
│     └─ src/
│        ├─ routers/ ships.ts  elements.ts  compute.ts  library.ts  publish.ts  registry.ts
│        ├─ services/ recompute.ts (imports @voidship/engine)  versioning.ts  render.ts
│        ├─ db/ prisma + RLS policies
│        └─ workers/ computeWorker.ts  renderWorker.ts   # BullMQ
└─ turbo.json / pnpm-workspace.yaml
```

### Core shared types

```ts
// packages/shared-types
type AttributeKind =
  | 'CAPACITY' | 'POOL' | 'SCALAR' | 'CATEGORICAL' | 'SLOTSET' | 'LIST';

type Op =
  | 'ADD' | 'MULTIPLY' | 'SET' | 'SET_MAX' | 'CLAMP_MIN'
  | 'SET_CATEGORICAL' | 'SHIFT_CATEGORICAL'
  | 'OCCUPY' | 'PROVIDE' | 'ADD_SKILL_MOD' | 'GRANT';

type ElementType =
  | 'Hull' | 'Component' | 'PastHistory' | 'MachineSpirit'
  | 'Ability' | 'Trait' | 'Achievement';

interface Binding {
  attribute: AttributeId;             // MUST be a Registry id (closed set)
  side?: 'total' | 'consumed' | 'current';  // required for CAPACITY
  op: Op;                             // must be legal for the attribute's kind
  value: number | string | { label: string; note?: string } | Record<string, number>;
  scope?: 'PERMANENT' | 'COMBAT_ONLY' | 'CONDITIONAL';
  condition?: ConditionPredicate;     // sandboxed, non-Turing-complete
  duration?: { until: string[] } | null;
  note?: string;                      // provenance shown in the breakdown
}

interface Element {
  id: string;
  type_: ElementType;
  name: string;                       // user-invented free text
  subtype?: string;                   // user-typed, unvalidated
  description?: string;
  enabled: boolean;
  bindings: Binding[];
}

interface ShipConfig {                // the self-contained sheet = source of truth
  id: string;
  name: string;
  schemaVersion: number;
  registryVersion: number;
  hull: Element;                      // type_: 'Hull'; bindings seed base sides
  elements: Element[];
  crewComposition?: CrewComposition;  // structured sub-model; may emit bindings
}
```

### Primary component & engine sketches

```tsx
// CENTER — orchestrates hull + sortable element list; selection drives the inspector
function BuilderCanvas() {
  const { sheet, selectElement } = useBuilderStore();
  return (
    <SortableList items={sheet.elements} onReorder={reorderElements}>
      <HullPanel hull={sheet.hull} onEdit={selectElement} />
      {sheet.elements.map(el => (
        <ElementCard key={el.id} element={el}
          onToggle={() => useBuilderStore.getState().toggleElement(el.id)}
          onSelect={() => selectElement(el.id)} />
      ))}
    </SortableList>
  );
}
```

```tsx
// RIGHT — the identical authoring form for every Element type
function PropertyInspector({ elementId }: { elementId: string }) {
  const el = useBuilderStore(s => s.sheet.elements.find(e => e.id === elementId));
  if (!el) return <EmptyState hint="Select or create an Element" />;
  return (
    <ElementForm element={el}>
      {el.bindings.map((b, i) => <EffectRow key={i} binding={b} index={i} />)}
      <AddEffectButton elementId={el.id} />   {/* opens AttributePicker — the one picklist */}
    </ElementForm>
  );
}
```

```ts
// The pure engine — deterministic phase order (mirrors §4a)
export function compute(sheet: ShipConfig, registry: Registry): ComputeResult {
  const acc = seedFromHull(sheet.hull, registry);   // 1. seed base/total/max
  initPools(acc);                                    // 2. current=max, consumed=0, used=0
  const bindings = collectEnabledBindings(sheet);    // 3. all non-hull bindings (+ crewComposition)
  for (const attr of registry.attributes) {          // 4. fold per attribute in op-order
    foldByKind(attr, bindings, acc);                 //    SET→SET_MAX→ADD→MULTIPLY→CLAMP_MIN→clamp
  }
  deriveSpare(acc);                                   // 5. spare = total − consumed/current
  const diagnostics = validate(acc, sheet, registry);// 6. content-agnostic validators
  return { summary: present(acc), diagnostics, trace: buildTrace(acc) };
}
```

```tsx
// One Summary renderer per kind — CAPACITY shown; PoolPanel/ScalarPanel/etc. mirror it
function CapacityPanel({ attr }: { attr: CapacitySummary }) {
  const tight = attr.spare <= 1, over = attr.spare < 0;
  return (
    <Panel onClick={() => openBreakdown(attr.id)} state={over ? 'error' : tight ? 'warn' : 'ok'}>
      <Bar total={attr.total} filled={attr.consumed} />
      <span>{attr.total} total / {attr.consumed} consumed → {attr.spare} spare</span>
    </Panel>
  );
}
```

---

## 5. Phase-by-Phase Development Roadmap

Four agile phases, each shippable. The throughline: prove the **bind-to-attribute → fold → render** loop on the smallest possible surface first, then widen the kinds, then add persistence/history, then publish/scale.

### Phase 1 — MVP: one Element, one attribute, live fold (≈ weeks 1–2)

**Goal:** the smallest end-to-end proof that an authored effect lands in the summary.

- `@voidship/engine` skeleton handling **CAPACITY only** (Power: total/consumed/spare) with the seed→fold→derive phases and op-order.
- Hand-entered Hull form for just the CAPACITY base values; a single Element type (**Component**) with Effect rows limited to `power` + `ADD` + side.
- The one picklist (Attribute Registry, loaded from baked-in JSON) and a live CapacityPanel.
- Zustand + Immer store with optimistic local recompute. No backend yet — sheet held in memory.
- **Exit criteria:** add a Component with `power.total +8`, watch spare change instantly; disable it, watch it revert. Golden-master test passes.

### Phase 2 — All attribute kinds & all Element types (≈ weeks 3–5)

**Goal:** the full custom-authoring surface, still client-only.

- Engine handles **every kind**: POOL, SCALAR, CATEGORICAL, SLOTSET, LIST — with their ops and aggregation rules. Reproduce the **§4a worked example exactly** as a golden test (final: Power 7 spare, Space 1 spare, Morale max 97, Crew Rate 35, +Creed achievement).
- All seven Element types share the one authoring form; subtype free-text; per-Element enable/disable.
- All six Summary renderers + the **Breakdown Inspector** (trace per attribute) + inline diagnostics (warnings/errors).
- `crewComposition` sub-model with Σ share = 100% enforcement and its emitted bindings.
- Authoring-time validation (Zod, op-legality, sanity caps, size caps).
- **Exit criteria:** a fully authored sheet matches the architecture's sample summary/diagnostics shape; toggling the Void Cathedral propagates across Morale/Space/SP/achievements.

### Phase 3 — Persistence, versioning, history, autosave (≈ weeks 6–8)

**Goal:** durable multi-tenant sheets with the same engine on the server.

- Backend: Fastify + tRPC, Prisma schema (tenant, project, ship, ship_version, library_element), Postgres **row-level security**.
- Ships/elements/config routes; **authoritative recompute importing `@voidship/engine`**; immutable `ship_version` writes; `summary_cache`/`diagnostics` denormalized; Redis cache keyed by `hash(sheet)`.
- Client: debounced **autosave (config diffs)**, server-wins reconciliation, version history + revert/branch.
- **Undo/redo** via Immer inverse-patches with coalescing.
- Stateless **`POST /v1/compute`** and `preview` for what-if.
- **Exit criteria:** edit offline → reconnect → flush; client and server summaries provably identical; revert to an old version reproduces it exactly.

### Phase 4 — Library, publish/render, scale & hardening (≈ weeks 9–11)

**Goal:** reuse, shareable artifacts, and production readiness.

- Personal **Library** with **copy-on-insert** (editing a library entry never mutates existing ships).
- **Publish/render** service: compile summary → HTML/PDF/JSON immutable assets, content-hashed, CDN-served; **BullMQ** stateless render + compute workers behind a queue.
- Security pass: condition-predicate sandbox audit, numeric/size caps enforced server-side, RLS tests.
- Performance: dirty-attribute index under large-sheet load; cache hit-rate tuning; (only if profiling demands) evaluate Rust→WASM for the fold.
- **Exit criteria:** save an Element to Library, insert a copy into a second ship, edit the original — first ship unchanged; publish a sheet, fetch the immutable CDN asset; load test the stateless workers.

### Cross-cutting from day one

Keep `@voidship/engine` pure and dependency-free, treat the Summary as **always-derived-never-stored**, and grow `registry.json` **only additively** so sheets authored today render identically forever (§2.3). The golden-master test suite — anchored on the §4a worked example — is the safety net that lets every later phase refactor freely.
