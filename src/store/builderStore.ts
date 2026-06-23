import { create } from "zustand";
import { produce } from "immer";
import type { Binding, CrewGroup, Element, ElementType, ShipConfig } from "../engine/types";
import { seedSheet } from "../data/seed";

// ---------------------------------------------------------------------------
// Builder draft state (§3). Sheet edits live in memory; persistence via file API.
// History is snapshot-based (past/future stacks) for robust undo/redo.
// ---------------------------------------------------------------------------

const HISTORY_CAP = 100;
const uid = () => "el_" + Math.random().toString(36).slice(2, 8);

export type SaveStatus = "idle" | "loading" | "saving" | "saved" | "error";

const NEW_ELEMENT_DEFAULT: Record<ElementType, Partial<Element>> = {
  Hull: { name: "Hull" },
  Component: { name: "New Component", subtype: "Supplemental" },
  PastHistory: { name: "New Past History" },
  MachineSpirit: { name: "New Machine Spirit" },
  Ability: { name: "New Ability" },
  Trait: { name: "New Trait" },
  Achievement: { name: "New Achievement" },
};

function findEl(sheet: ShipConfig, id: string): Element | undefined {
  if (id === "hull") return sheet.hull;
  return sheet.elements.find((e) => e.id === id);
}

interface BuilderStore {
  sheet: ShipConfig;
  shipId: string | null;
  selectedId: string | null; // "hull" or an element id
  breakdownAttr: string | null;
  isPlayMode: boolean;
  isDirty: boolean;
  saveStatus: SaveStatus;
  past: ShipConfig[];
  future: ShipConfig[];

  canUndo: () => boolean;
  canRedo: () => boolean;

  select: (id: string | null) => void;
  openBreakdown: (attr: string | null) => void;
  setPlayMode: (on: boolean) => void;
  setShipName: (name: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
  loadSheet: (sheet: ShipConfig, id: string) => void;
  markSaved: () => void;

  commit: (fn: (s: ShipConfig) => void) => void;
  undo: () => void;
  redo: () => void;
  importSheet: (sheet: ShipConfig) => void;

  addElement: (type_: ElementType) => void;
  removeElement: (id: string) => void;
  toggleElement: (id: string) => void;
  updateElementMeta: (
    id: string,
    patch: Partial<Pick<Element, "name" | "subtype" | "description">>
  ) => void;
  reorderElement: (from: number, to: number) => void;

  addBinding: (elId: string, b: Binding) => void;
  updateBinding: (elId: string, idx: number, b: Binding) => void;
  removeBinding: (elId: string, idx: number) => void;

  initCrew: () => void;
  addCrewGroup: () => void;
  updateCrewGroup: (idx: number, patch: Partial<CrewGroup>) => void;
  removeCrewGroup: (idx: number) => void;

  // Live play-state: set/clear the current value override for an attribute.
  setCurrentValue: (attrId: string, value: number | null) => void;
}

export const useBuilder = create<BuilderStore>((set, get) => ({
  sheet: seedSheet(),
  shipId: null,
  selectedId: "hull",
  breakdownAttr: null,
  isPlayMode: false,
  isDirty: false,
  saveStatus: "idle",
  past: [],
  future: [],

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  select: (id) => set({ selectedId: id }),
  openBreakdown: (attr) => set({ breakdownAttr: attr }),
  setPlayMode: (on) =>
    set((state) => ({
      isPlayMode: on,
      breakdownAttr: on ? null : state.breakdownAttr,
      selectedId: on ? null : state.selectedId ?? "hull",
    })),
  setShipName: (name) => get().commit((s) => void (s.name = name)),
  setSaveStatus: (status) => set({ saveStatus: status }),
  loadSheet: (sheet, id) =>
    set({
      sheet: structuredClone(sheet),
      shipId: id,
      selectedId: "hull",
      breakdownAttr: null,
      isPlayMode: false,
      isDirty: false,
      saveStatus: "saved",
      past: [],
      future: [],
    }),
  markSaved: () => set({ isDirty: false, saveStatus: "saved" }),

  commit: (fn) =>
    set((state) => {
      const next = produce(state.sheet, fn);
      if (next === state.sheet) return {};
      const past = [...state.past, state.sheet].slice(-HISTORY_CAP);
      return { sheet: next, past, future: [], isDirty: true, saveStatus: "idle" };
    }),

  undo: () =>
    set((state) => {
      if (!state.past.length) return {};
      const prev = state.past[state.past.length - 1];
      return {
        sheet: prev,
        past: state.past.slice(0, -1),
        future: [state.sheet, ...state.future],
      };
    }),

  redo: () =>
    set((state) => {
      if (!state.future.length) return {};
      const next = state.future[0];
      return {
        sheet: next,
        future: state.future.slice(1),
        past: [...state.past, state.sheet],
      };
    }),

  importSheet: (sheet) =>
    set({
      sheet: structuredClone(sheet),
      selectedId: "hull",
      past: [],
      future: [],
      breakdownAttr: null,
      isPlayMode: false,
      isDirty: true,
      saveStatus: "idle",
    }),

  addElement: (type_) => {
    const id = uid();
    get().commit((s) => {
      s.elements.push({
        id,
        type_,
        enabled: true,
        bindings: [],
        ...NEW_ELEMENT_DEFAULT[type_],
      } as Element);
    });
    set({ selectedId: id });
  },

  removeElement: (id) => {
    get().commit((s) => {
      s.elements = s.elements.filter((e) => e.id !== id);
    });
    if (get().selectedId === id) set({ selectedId: "hull" });
  },

  toggleElement: (id) =>
    get().commit((s) => {
      const el = s.elements.find((e) => e.id === id);
      if (el) el.enabled = !el.enabled;
    }),

  updateElementMeta: (id, patch) =>
    get().commit((s) => {
      const el = findEl(s, id);
      if (el) Object.assign(el, patch);
    }),

  reorderElement: (from, to) =>
    get().commit((s) => {
      if (from === to || from < 0 || to < 0 || from >= s.elements.length || to >= s.elements.length)
        return;
      const [moved] = s.elements.splice(from, 1);
      s.elements.splice(to, 0, moved);
    }),

  addBinding: (elId, b) =>
    get().commit((s) => {
      const el = findEl(s, elId);
      if (el) el.bindings.push(b);
    }),

  updateBinding: (elId, idx, b) =>
    get().commit((s) => {
      const el = findEl(s, elId);
      if (el && el.bindings[idx]) el.bindings[idx] = b;
    }),

  removeBinding: (elId, idx) =>
    get().commit((s) => {
      const el = findEl(s, elId);
      if (el) el.bindings.splice(idx, 1);
    }),

  initCrew: () =>
    get().commit((s) => {
      if (!s.crewComposition)
        s.crewComposition = { groups: [{ name: "Crew", sharePct: 100 }], bindings: [] };
    }),

  addCrewGroup: () =>
    get().commit((s) => {
      if (!s.crewComposition) s.crewComposition = { groups: [], bindings: [] };
      s.crewComposition.groups.push({ name: "New group", sharePct: 0 });
    }),

  updateCrewGroup: (idx, patch) =>
    get().commit((s) => {
      const g = s.crewComposition?.groups[idx];
      if (g) Object.assign(g, patch);
    }),

  removeCrewGroup: (idx) =>
    get().commit((s) => {
      s.crewComposition?.groups.splice(idx, 1);
    }),

  setCurrentValue: (attrId, value) =>
    get().commit((s) => {
      if (value == null) {
        if (s.current) delete s.current[attrId];
      } else {
        if (!s.current) s.current = {};
        s.current[attrId] = value;
      }
    }),
}));
