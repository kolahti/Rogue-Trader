import type { AttributeDef, AttributeKind, Binding, ElementType, Op, Scope } from "./types";

// The fixed component classes (Rogue Trader). A Component's subtype is chosen
// from this list; play mode groups the component readout by these headings.
export const COMPONENT_SUBTYPES = [
  "Essential",
  "Supplemental",
  "Weapon",
  "Archeo-xenotech",
  "Upgrades",
  "Habitat",
] as const;
export type ComponentSubtype = (typeof COMPONENT_SUBTYPES)[number];

// Component build quality. "Common" is the baseline default.
export const COMPONENT_QUALITIES = ["Poor", "Common", "Good", "Best"] as const;
export type ComponentQuality = (typeof COMPONENT_QUALITIES)[number];
export const DEFAULT_COMPONENT_QUALITY: ComponentQuality = "Common";

export const COMPONENT_LOCATIONS = ["Upper Decks", "Hold"] as const;
export type ComponentLocation = (typeof COMPONENT_LOCATIONS)[number];

// Plain-language, pluralised headings for element types in the play readout.
export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  Hull: "Hull",
  Component: "Components",
  PastHistory: "Past History",
  MachineSpirit: "Machine Spirits",
  Ability: "Abilities",
  Trait: "Traits",
  Achievement: "Achievements",
};

// ---------------------------------------------------------------------------
// THE ATTRIBUTE REGISTRY — the one fixed contract (§1.2).
// This is the only thing the user cannot invent. An effect can only ever
// target one of these ids, and the kind decides what the effect's number does.
// Grows only additively, so sheets authored today render identically forever.
// ---------------------------------------------------------------------------

export const REGISTRY_VERSION = 2;

export const REGISTRY: AttributeDef[] = [
  { id: "power", label: "Power", kind: "CAPACITY", sides: ["total", "consumed"] },
  { id: "space", label: "Space", kind: "CAPACITY", sides: ["total", "consumed"] },
  { id: "population", label: "Population", kind: "CAPACITY", sides: ["total", "current"] },
  { id: "shipPoints", label: "Ship Points", kind: "CAPACITY", sides: ["total", "consumed"] },

  { id: "morale", label: "Morale", kind: "POOL", base: 100 },
  { id: "hullIntegrity", label: "Hull Integrity", kind: "POOL", base: 0 },

  { id: "crewRate", label: "Crew Rate", kind: "SCALAR" },
  { id: "piloting", label: "Piloting", kind: "SCALAR" },
  { id: "speed", label: "Speed", kind: "SCALAR" },
  { id: "manoeuvrability", label: "Manoeuvrability", kind: "SCALAR" },
  { id: "detection", label: "Detection", kind: "SCALAR" },
  { id: "armour", label: "Armour", kind: "SCALAR" },
  { id: "turretRating", label: "Turret Rating", kind: "SCALAR" },

  { id: "creed", label: "Creed", kind: "CATEGORICAL", scale: ["Low", "Moderate", "High", "Fervent"] },

  { id: "weaponSlots", label: "Weapon Slots", kind: "SLOTSET", mounts: ["prow", "dorsal", "port", "starboard", "keel"] },

  { id: "weapons", label: "Weapons", kind: "LIST" },
  { id: "abilities", label: "Abilities", kind: "LIST" },
  { id: "traits", label: "Traits", kind: "LIST" },
  { id: "achievements", label: "Achievements", kind: "LIST" },
  { id: "skillMods", label: "Skill Modifiers", kind: "LIST" },
];

export const REGISTRY_BY_ID: Record<string, AttributeDef> = Object.fromEntries(
  REGISTRY.map((a) => [a.id, a])
);

export function labelOf(id: string): string {
  return REGISTRY_BY_ID[id]?.label ?? id;
}

// Weapon stats formatted as one line — shared by the component card, the
// aggregate Weapons list, and the JSON note. Empty when no stat is set.
export function weaponStatLine(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const w = v as {
    strength?: unknown;
    damage?: unknown;
    crit?: unknown;
    rangeShort?: unknown;
    rangeMedium?: unknown;
    rangeLong?: unknown;
    special?: unknown;
  };
  const set = (x: unknown): boolean => x != null && x !== "";
  const parts: string[] = [];
  if (set(w.strength)) parts.push(`Str ${w.strength}`);
  if (set(w.damage)) parts.push(`Dam ${w.damage}`);
  if (set(w.crit)) parts.push(`Crit ${w.crit}`);
  if (set(w.rangeShort) || set(w.rangeMedium) || set(w.rangeLong)) {
    parts.push(
      `Range ${Number(w.rangeShort) || 0}/${Number(w.rangeMedium) || 0}/${Number(w.rangeLong) || 0}`
    );
  }
  if (w.special) parts.push(`Special: ${w.special}`);
  return parts.join(" · ");
}

// One binding rendered as a plain-language phrase — the "what it does" line on a
// component card. Mirrors the fold semantics in compute.ts so the readout never
// contradicts the value it produces.
export function describeBinding(b: Binding): string {
  const attr = REGISTRY_BY_ID[b.attribute];
  const label = attr?.label ?? b.attribute;
  const n = (v: unknown): number => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const signed = (v: number): string => (v >= 0 ? `+${v}` : String(v));

  let base: string;
  switch (attr?.kind) {
    case "CAPACITY": {
      const side = b.side ?? attr.sides![0];
      base = b.op === "SET" ? `${label} = ${n(b.value)} ${side}` : `${label} ${signed(n(b.value))} ${side}`;
      break;
    }
    case "POOL":
      base =
        b.op === "SET_MAX"
          ? `${label} max ${n(b.value)}`
          : b.op === "CLAMP_MIN"
            ? `${label} at least ${n(b.value)}`
            : b.op === "SUBTRACT"
              ? `${label} -${Math.abs(n(b.value))}`
              : `${label} ${signed(n(b.value))}`;
      break;
    case "SCALAR":
      base =
        b.op === "SET"
          ? `${label} = ${n(b.value)}`
          : b.op === "MULTIPLY"
            ? `${label} ×${n(b.value)}`
            : b.op === "CLAMP_MIN"
              ? `${label} at least ${n(b.value)}`
              : b.op === "SUBTRACT"
                ? `${label} -${Math.abs(n(b.value))}`
                : `${label} ${signed(n(b.value))}`;
      break;
    case "CATEGORICAL": {
      if (b.op === "SET_CATEGORICAL") {
        base = `${label}: ${b.value}`;
      } else {
        const step = n(b.value);
        base = `${label} ${signed(step)} step${Math.abs(step) === 1 ? "" : "s"}`;
      }
      break;
    }
    case "SLOTSET": {
      const rec = (b.value && typeof b.value === "object" ? b.value : {}) as Record<string, number>;
      const parts = Object.entries(rec).map(([m, c]) => `${m} ×${n(c)}`);
      base = `${b.op === "PROVIDE" ? "Provides" : "Occupies"} ${parts.join(", ")}`;
      break;
    }
    case "LIST": {
      const v = b.value as { label?: string; test?: string; mod?: unknown; condition?: string } | string;
      if (b.op === "ADD_SKILL_MOD" && typeof v === "object") {
        const name = v.label ?? v.test ?? "";
        const cond = v.condition ? ` (when ${v.condition})` : "";
        base = `${name} ${signed(n(v.mod))}${cond}`;
      } else if (typeof v === "string") {
        base = v;
      } else {
        const stats = b.attribute === "weapons" ? weaponStatLine(v) : "";
        const name = v.label ?? "";
        base = stats ? (name ? `${name} — ${stats}` : stats) : name;
      }
      break;
    }
    default:
      base = label;
  }

  const scope = b.scope ?? "PERMANENT";
  if (scope !== "PERMANENT") {
    base += b.condition
      ? ` · when ${Object.values(b.condition).join(", ")}`
      : ` · ${SCOPE_LABELS[scope].toLowerCase()}`;
  }
  return base;
}

// Same fold semantics as describeBinding, but split into a left-hand label and a
// right-hand value — for the label/value readout on play-mode component cards.
export function describeBindingParts(b: Binding): {
  label: string;
  value: string;
  condition?: string;
} {
  const attr = REGISTRY_BY_ID[b.attribute];
  const attrLabel = attr?.label ?? b.attribute;
  const n = (v: unknown): number => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const signed = (v: number): string => (v >= 0 ? `+${v}` : String(v));

  let label = attrLabel;
  let value = "";
  switch (attr?.kind) {
    case "CAPACITY": {
      // Play readout drops the side word ("total"/"consumed"/"current") and shows
      // the relationship as a sign: consuming capacity subtracts (-), setting a
      // value is (=), and any other addition adds (+).
      const side = b.side ?? attr.sides![0];
      const amt = n(b.value);
      value =
        side === "consumed"
          ? `- ${Math.abs(amt)}`
          : b.op === "SET"
            ? `= ${amt}`
            : `+ ${Math.abs(amt)}`;
      break;
    }
    case "POOL":
      value =
        b.op === "SET_MAX"
          ? `max ${n(b.value)}`
          : b.op === "CLAMP_MIN"
            ? `≥ ${n(b.value)}`
            : b.op === "SUBTRACT"
              ? `-${Math.abs(n(b.value))}`
              : signed(n(b.value));
      break;
    case "SCALAR":
      value =
        b.op === "SET"
          ? `= ${n(b.value)}`
          : b.op === "MULTIPLY"
            ? `×${n(b.value)}`
            : b.op === "CLAMP_MIN"
              ? `≥ ${n(b.value)}`
              : b.op === "SUBTRACT"
                ? `-${Math.abs(n(b.value))}`
                : signed(n(b.value));
      break;
    case "CATEGORICAL": {
      const step = n(b.value);
      value =
        b.op === "SET_CATEGORICAL"
          ? String(b.value)
          : `${signed(step)} step${Math.abs(step) === 1 ? "" : "s"}`;
      break;
    }
    case "SLOTSET": {
      const rec = (b.value && typeof b.value === "object" ? b.value : {}) as Record<string, number>;
      label = b.op === "PROVIDE" ? "Provides slots" : "Occupies slots";
      value = Object.entries(rec)
        .map(([m, c]) => `${m} ×${n(c)}`)
        .join(", ");
      break;
    }
    case "LIST": {
      const v = b.value as { label?: string; test?: string; mod?: unknown; condition?: string } | string;
      if (b.op === "ADD_SKILL_MOD" && typeof v === "object") {
        const name = v.label ?? v.test ?? "";
        const cond = v.condition ? ` (when ${v.condition})` : "";
        value = `${name} ${signed(n(v.mod))}${cond}`;
      } else if (typeof v === "string") {
        value = v;
      } else {
        const stats = b.attribute === "weapons" ? weaponStatLine(v) : "";
        if (v.label) label = v.label;
        value = stats;
      }
      break;
    }
    default:
      value = "";
  }

  const scope = b.scope ?? "PERMANENT";
  const condition =
    scope === "PERMANENT"
      ? undefined
      : b.condition
        ? `when ${Object.values(b.condition).join(", ")}`
        : SCOPE_LABELS[scope].toLowerCase();
  return { label, value, condition };
}

export function isSkillModBinding(b: Binding): boolean {
  return b.attribute === "skillMods" && b.op === "ADD_SKILL_MOD";
}

// Split a skill-modifier binding into its display parts: the skill name, the
// signed modifier, and an optional condition — for the grouped play readout.
export function skillModParts(b: Binding): {
  name: string;
  value: string;
  condition?: string;
} {
  const v = (b.value && typeof b.value === "object" ? b.value : {}) as {
    label?: string;
    test?: string;
    mod?: unknown;
    condition?: string;
  };
  const mod = Number(v.mod);
  const value = Number.isFinite(mod) ? (mod >= 0 ? `+${mod}` : String(mod)) : "";
  return { name: v.label ?? v.test ?? "", value, condition: v.condition };
}

export function isAbilityBinding(b: Binding): boolean {
  return b.attribute === "abilities" && b.op === "GRANT";
}

// Split an ability grant into display parts, mirroring the skill-modifier
// readout: the ability name, its note (right-hand value), and an optional
// condition drawn from the binding's scope.
export function abilityParts(b: Binding): {
  name: string;
  value: string;
  condition?: string;
} {
  const v = (b.value && typeof b.value === "object" ? b.value : {}) as {
    label?: string;
    note?: string;
  };
  const scope = b.scope ?? "PERMANENT";
  const condition =
    scope === "PERMANENT"
      ? undefined
      : b.condition
        ? Object.values(b.condition).join(", ")
        : SCOPE_LABELS[scope].toLowerCase();
  return { name: v.label ?? "", value: v.note ?? "", condition };
}

// Legal ops per kind — the UI only ever offers these (§1.4).
export const OPS_BY_KIND: Record<AttributeKind, Op[]> = {
  CAPACITY: ["ADD", "SET"],
  POOL: ["ADD", "SUBTRACT", "SET_MAX", "CLAMP_MIN"],
  SCALAR: ["ADD", "SUBTRACT", "MULTIPLY", "SET", "CLAMP_MIN"],
  CATEGORICAL: ["SET_CATEGORICAL", "SHIFT_CATEGORICAL"],
  SLOTSET: ["PROVIDE", "OCCUPY"],
  LIST: ["GRANT", "ADD_SKILL_MOD"],
};

// ---------------------------------------------------------------------------
// Plain-language labels — the engine speaks enums; the user reads English.
// Every dropdown that would otherwise leak a raw token maps through these.
// ---------------------------------------------------------------------------
export const OP_LABELS: Record<Op, string> = {
  ADD: "Add",
  SUBTRACT: "Subtract",
  MULTIPLY: "Multiply by",
  SET: "Set to",
  SET_MAX: "Set maximum to",
  CLAMP_MIN: "At least",
  SET_CATEGORICAL: "Set to",
  SHIFT_CATEGORICAL: "Shift by",
  OCCUPY: "Occupy",
  PROVIDE: "Provide",
  ADD_SKILL_MOD: "Skill modifier",
  GRANT: "Grant",
};

export const OP_HINTS: Record<Op, string> = {
  ADD: "Add this amount to the running value.",
  SUBTRACT: "Subtract this amount from the running value.",
  MULTIPLY: "Multiply the running value by this factor.",
  SET: "Replace the value (last one wins).",
  SET_MAX: "Set the pool's maximum.",
  CLAMP_MIN: "Raise the value to this floor if it is lower.",
  SET_CATEGORICAL: "Pick a level on the scale.",
  SHIFT_CATEGORICAL: "Move up (+) or down (−) the scale.",
  OCCUPY: "Take up mounts of this kind.",
  PROVIDE: "Add mounts of this kind.",
  ADD_SKILL_MOD: "Add a named, optionally conditional, skill bonus.",
  GRANT: "Add a named entry to this list.",
};

export const SCOPE_LABELS: Record<Scope, string> = {
  PERMANENT: "Always active",
  COMBAT_ONLY: "In combat only",
  CONDITIONAL: "Only when…",
};

// Human group headings for the one picklist, grouped by attribute kind.
export const KIND_LABELS: Record<AttributeKind, string> = {
  CAPACITY: "Capacities",
  POOL: "Pools",
  SCALAR: "Ratings",
  CATEGORICAL: "Creed",
  SLOTSET: "Weapon mounts",
  LIST: "Lists & grants",
};

// Play-mode dashboard sections — semantic groupings a player references at the
// table, independent of attribute kind. Any registry attribute not listed below
// falls into "Other", so the dashboard stays complete as the registry grows.
export const DASHBOARD_SECTIONS: { title: string; attrs: string[] }[] = (() => {
  const defined = [
    { title: "Capacities", attrs: ["power", "space", "shipPoints", "population"] },
    { title: "Condition", attrs: ["hullIntegrity", "morale"] },
    {
      title: "Performance",
      attrs: ["speed", "manoeuvrability", "detection", "armour", "turretRating", "crewRate", "piloting"],
    },
    { title: "Doctrine", attrs: ["creed"] },
    { title: "Armament", attrs: ["weaponSlots", "weapons"] },
    { title: "Honours & Abilities", attrs: ["abilities", "traits", "achievements", "skillMods"] },
  ];
  const listed = new Set(defined.flatMap((s) => s.attrs));
  const others = REGISTRY.filter((a) => !listed.has(a.id)).map((a) => a.id);
  if (others.length) defined.push({ title: "Other", attrs: others });
  return defined
    .map((s) => ({ title: s.title, attrs: s.attrs.filter((id) => REGISTRY_BY_ID[id]) }))
    .filter((s) => s.attrs.length > 0);
})();

// REGISTRY grouped by kind, preserving registry order — drives <optgroup>s.
export const REGISTRY_GROUPS: { kind: AttributeKind; label: string; attrs: AttributeDef[] }[] =
  (() => {
    const order: AttributeKind[] = [];
    const byKind = new Map<AttributeKind, AttributeDef[]>();
    for (const a of REGISTRY) {
      if (!byKind.has(a.kind)) {
        byKind.set(a.kind, []);
        order.push(a.kind);
      }
      byKind.get(a.kind)!.push(a);
    }
    return order.map((kind) => ({ kind, label: KIND_LABELS[kind], attrs: byKind.get(kind)! }));
  })();
