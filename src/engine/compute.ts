import type {
  AttributeDef,
  AttrSummary,
  Binding,
  ComputeResult,
  Diagnostic,
  ListEntry,
  ShipConfig,
  TraceEntry,
} from "./types";
import { REGISTRY, labelOf } from "./registry";

// ---------------------------------------------------------------------------
// THE RESOLUTION ENGINE — pure, deterministic, dependency-free (§4a).
//   compute(sheet, registry) -> { summary, diagnostics, trace }
// Both the client (instant) and (in a full build) the server import this same
// function, so the two can never disagree.
// ---------------------------------------------------------------------------

interface SourcedBinding extends Binding {
  __source: string;
  __type: string;
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Phase 3: collect all enabled bindings (hull always seeds; disabled elements skipped).
function gather(sheet: ShipConfig): SourcedBinding[] {
  const out: SourcedBinding[] = [];
  const push = (name: string, type_: string, bindings: Binding[]) =>
    bindings.forEach((b) => out.push({ ...b, __source: name, __type: type_ }));

  push(sheet.hull.name || "Hull", "Hull", sheet.hull.bindings);
  sheet.elements
    .filter((e) => e.enabled)
    .forEach((e) => push(e.name, e.type_, e.bindings));
  if (sheet.crewComposition) {
    push("Class Division", "CrewComposition", sheet.crewComposition.bindings);
  }
  return out;
}

function foldAttr(
  attr: AttributeDef,
  bs: SourcedBinding[],
  conditionalMods: ListEntry[]
): AttrSummary {
  switch (attr.kind) {
    case "CAPACITY": {
      const sides = attr.sides!;
      const secondLabel = sides[1];
      // op-order fold per side: SET (last wins) then ADD (sum)
      const calcSide = (side: string, base: number) => {
        let v = base;
        const ss = bs.filter((b) => (b.side ?? sides[0]) === side);
        for (const b of ss) if (b.op === "SET") v = num(b.value);
        for (const b of ss) if (b.op === "ADD") v += num(b.value);
        return v;
      };
      const total = calcSide("total", 0);
      // population's "current" defaults to full headcount when nothing reduces it
      const second = calcSide(secondLabel, secondLabel === "current" ? total : 0);
      return { kind: "CAPACITY", total, second, secondLabel, spare: total - second };
    }

    case "POOL": {
      let max = attr.base ?? 0;
      const setMax = bs.filter((b) => b.op === "SET_MAX");
      if (setMax.length) max = num(setMax[setMax.length - 1].value);
      for (const b of bs) if (b.op === "ADD") max += num(b.value);
      for (const b of bs) if (b.op === "CLAMP_MIN") max = Math.max(max, num(b.value));
      // no play-state in the builder: current tracks max
      return { kind: "POOL", max, current: max };
    }

    case "SCALAR": {
      // CONDITIONAL / COMBAT_ONLY effects don't fold into the permanent value;
      // they surface as skill modifiers (matches the sample summary).
      let v = 0;
      const perm = bs.filter((b) => (b.scope ?? "PERMANENT") === "PERMANENT");
      for (const b of bs) {
        if ((b.scope ?? "PERMANENT") !== "PERMANENT") {
          conditionalMods.push({
            label: attr.label,
            mod: num(b.value),
            condition: b.condition
              ? Object.values(b.condition).join(", ")
              : b.scope,
            source: b.__source,
          });
        }
      }
      for (const b of perm) if (b.op === "SET") v = num(b.value);
      for (const b of perm) if (b.op === "ADD") v += num(b.value);
      for (const b of perm) if (b.op === "MULTIPLY") v *= num(b.value);
      for (const b of perm) if (b.op === "CLAMP_MIN") v = Math.max(v, num(b.value));
      return { kind: "SCALAR", value: v };
    }

    case "CATEGORICAL": {
      const scale = attr.scale!;
      let idx = 0;
      const sets = bs.filter((b) => b.op === "SET_CATEGORICAL");
      if (sets.length) {
        const lbl = String(sets[sets.length - 1].value);
        idx = Math.max(0, scale.indexOf(lbl));
      }
      for (const b of bs) if (b.op === "SHIFT_CATEGORICAL") idx += num(b.value);
      idx = Math.min(scale.length - 1, Math.max(0, idx));
      return { kind: "CATEGORICAL", label: scale[idx], scale };
    }

    case "SLOTSET": {
      const mounts: Record<string, { used: number; total: number }> = {};
      for (const m of attr.mounts!) mounts[m] = { used: 0, total: 0 };
      for (const b of bs) {
        const rec =
          b.value && typeof b.value === "object" ? (b.value as Record<string, number>) : {};
        for (const [m, c] of Object.entries(rec)) {
          if (!mounts[m]) mounts[m] = { used: 0, total: 0 };
          if (b.op === "PROVIDE") mounts[m].total += num(c);
          if (b.op === "OCCUPY") mounts[m].used += num(c);
        }
      }
      return { kind: "SLOTSET", mounts };
    }

    case "LIST": {
      const entries: ListEntry[] = [];
      for (const b of bs) {
        const val: any = b.value;
        if (b.op === "GRANT") {
          entries.push({
            label: typeof val === "string" ? val : val?.label ?? "",
            note: typeof val === "object" ? val?.note : undefined,
            source: b.__source,
          });
        } else if (b.op === "ADD_SKILL_MOD") {
          entries.push({
            label: val?.label ?? val?.test ?? "",
            mod: num(val?.mod),
            condition: val?.condition,
            source: b.__source,
          });
        }
      }
      return { kind: "LIST", entries };
    }
  }
}

// Phase 6: validation -> diagnostics. Content-agnostic (reads the summary).
function validate(
  summary: Record<string, AttrSummary>,
  sheet: ShipConfig
): Diagnostic[] {
  const d: Diagnostic[] = [];
  for (const [id, s] of Object.entries(summary)) {
    if (s.kind === "CAPACITY" && s.secondLabel === "consumed") {
      if (s.spare < 0)
        d.push({
          level: "error",
          code: `${id.toUpperCase()}_NEGATIVE`,
          message: `${labelOf(id)} over capacity by ${-s.spare}.`,
        });
      else if (id === "shipPoints" && s.spare === 0)
        d.push({
          level: "error",
          code: "SHIPPOINTS_EXHAUSTED",
          message: "Ship Points spare is 0.",
        });
      else if (s.spare <= 1)
        d.push({
          level: "warning",
          code: `${id.toUpperCase()}_TIGHT`,
          message: `Only ${s.spare} ${labelOf(id)} spare.`,
        });
    }
    if (s.kind === "CAPACITY" && s.secondLabel === "current" && s.second > s.total) {
      d.push({
        level: "error",
        code: "POPULATION_OVER",
        message: "Current population exceeds total.",
      });
    }
    if (s.kind === "SLOTSET") {
      for (const [m, v] of Object.entries(s.mounts))
        if (v.used > v.total)
          d.push({
            level: "error",
            code: "SLOT_OVER",
            message: `${m} mounts over capacity (${v.used}/${v.total}).`,
          });
    }
  }
  const power = summary["power"];
  if (power && power.kind === "CAPACITY" && power.total === 0)
    d.push({
      level: "warning",
      code: "NO_POWER",
      message: "No power generator authored (total Power = 0).",
    });

  if (sheet.crewComposition) {
    const sum = sheet.crewComposition.groups.reduce((a, g) => a + g.sharePct, 0);
    if (sum !== 100)
      d.push({
        level: "warning",
        code: "CREW_SHARES",
        message: `Crew shares sum to ${sum}% (should be 100%).`,
      });
  }
  return d;
}

export function compute(sheet: ShipConfig, registry = REGISTRY): ComputeResult {
  const all = gather(sheet);
  const summary: Record<string, AttrSummary> = {};
  const trace: Record<string, TraceEntry[]> = {};
  const conditionalMods: ListEntry[] = [];

  for (const attr of registry) {
    const mine = all.filter((b) => b.attribute === attr.id);
    trace[attr.id] = mine.map((b) => ({
      source: b.__source,
      type_: b.__type,
      op: b.op,
      side: b.side,
      value: b.value,
      note: b.note,
      scope: b.scope,
    }));
    summary[attr.id] = foldAttr(attr, mine, conditionalMods);
  }

  // merge conditional scalar effects into the skillMods list
  const sm = summary["skillMods"];
  if (sm && sm.kind === "LIST") sm.entries.push(...conditionalMods);

  const diagnostics = validate(summary, sheet);
  return { summary, diagnostics, trace };
}
