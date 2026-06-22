// ---------------------------------------------------------------------------
// Core shared types — the two primitives (Attribute, Element) + Binding + Sheet.
// Mirrors §1 of the architecture document.
// ---------------------------------------------------------------------------

export type AttributeKind =
  | "CAPACITY"
  | "POOL"
  | "SCALAR"
  | "CATEGORICAL"
  | "SLOTSET"
  | "LIST";

export type Op =
  | "ADD"
  | "MULTIPLY"
  | "SET"
  | "SET_MAX"
  | "CLAMP_MIN"
  | "SET_CATEGORICAL"
  | "SHIFT_CATEGORICAL"
  | "OCCUPY"
  | "PROVIDE"
  | "ADD_SKILL_MOD"
  | "GRANT";

export type ElementType =
  | "Hull"
  | "Component"
  | "PastHistory"
  | "MachineSpirit"
  | "Ability"
  | "Trait"
  | "Achievement";

export type CapacitySide = "total" | "consumed" | "current";
export type Scope = "PERMANENT" | "COMBAT_ONLY" | "CONDITIONAL";

// The closed vocabulary entry — system-defined, never user-authored.
export interface AttributeDef {
  id: string;
  label: string;
  kind: AttributeKind;
  sides?: CapacitySide[]; // CAPACITY
  base?: number; // POOL
  scale?: string[]; // CATEGORICAL
  mounts?: string[]; // SLOTSET
}

// The atom that lands in the Summary View.
export interface Binding {
  attribute: string; // MUST be an Attribute Registry id
  side?: CapacitySide; // required for CAPACITY
  op: Op;
  // number | label | {label,note} | {label,mod,condition} | {mount: count}
  value: any;
  scope?: Scope;
  condition?: Record<string, string>;
  note?: string;
}

// Every custom building block — one shape.
export interface Element {
  id: string;
  type_: ElementType;
  name: string;
  subtype?: string;
  description?: string;
  enabled: boolean;
  bindings: Binding[];
}

export interface CrewGroup {
  name: string;
  sharePct: number;
}
export interface CrewComposition {
  groups: CrewGroup[];
  bindings: Binding[];
}

// The self-contained sheet — canonical, persisted truth.
export interface ShipConfig {
  id: string;
  name: string;
  schemaVersion: number;
  registryVersion: number;
  hull: Element;
  elements: Element[];
  crewComposition?: CrewComposition;
}

// ---------------------------------------------------------------------------
// Computed output (derived, never stored)
// ---------------------------------------------------------------------------

export interface ListEntry {
  label: string;
  note?: string;
  mod?: number;
  condition?: string;
  source: string;
}

export type AttrSummary =
  | {
      kind: "CAPACITY";
      total: number;
      second: number;
      secondLabel: CapacitySide;
      spare: number;
    }
  | { kind: "POOL"; max: number; current: number }
  | { kind: "SCALAR"; value: number }
  | { kind: "CATEGORICAL"; label: string; scale: string[] }
  | { kind: "SLOTSET"; mounts: Record<string, { used: number; total: number }> }
  | { kind: "LIST"; entries: ListEntry[] };

export interface Diagnostic {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface TraceEntry {
  source: string;
  type_: string;
  op: Op;
  side?: CapacitySide;
  value: any;
  note?: string;
  scope?: Scope;
}

export interface ComputeResult {
  summary: Record<string, AttrSummary>;
  diagnostics: Diagnostic[];
  trace: Record<string, TraceEntry[]>;
}
