import type { AttributeDef, AttributeKind, Op, Scope } from "./types";

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

// Legal ops per kind — the UI only ever offers these (§1.4).
export const OPS_BY_KIND: Record<AttributeKind, Op[]> = {
  CAPACITY: ["ADD", "SET"],
  POOL: ["ADD", "SET_MAX", "CLAMP_MIN"],
  SCALAR: ["ADD", "MULTIPLY", "SET", "CLAMP_MIN"],
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
