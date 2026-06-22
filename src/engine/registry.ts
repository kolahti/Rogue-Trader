import type { AttributeDef, AttributeKind, Op } from "./types";

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
