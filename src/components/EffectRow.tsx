import type { Binding, Op, Scope } from "../engine/types";
import { REGISTRY, REGISTRY_BY_ID, OPS_BY_KIND } from "../engine/registry";

// ---------------------------------------------------------------------------
// The Effect Binding atom (§1.4): Attribute ▾  (the ONE picklist)  →  Op ▾  →
// a value field typed to the op/kind. Choosing an attribute reveals only the
// ops legal for its kind. On any change the Summary recomputes live.
// ---------------------------------------------------------------------------

const SCOPES: Scope[] = ["PERMANENT", "COMBAT_ONLY", "CONDITIONAL"];

function defaultValueFor(attrId: string, op: Op): any {
  const attr = REGISTRY_BY_ID[attrId];
  if (attr.kind === "CATEGORICAL") return op === "SET_CATEGORICAL" ? attr.scale![0] : 1;
  if (attr.kind === "SLOTSET") return { [attr.mounts![0]]: 1 };
  if (attr.kind === "LIST")
    return attr.id === "skillMods"
      ? { label: "", mod: 0, condition: "" }
      : { label: "", note: "" };
  return 0;
}

export function EffectRow({
  binding,
  onChange,
  onRemove,
}: {
  binding: Binding;
  onChange: (b: Binding) => void;
  onRemove: () => void;
}) {
  const attr = REGISTRY_BY_ID[binding.attribute] ?? REGISTRY[0];
  const legalOps = OPS_BY_KIND[attr.kind];

  const onAttr = (attrId: string) => {
    const a = REGISTRY_BY_ID[attrId];
    const op = OPS_BY_KIND[a.kind][0];
    onChange({
      ...binding,
      attribute: attrId,
      op,
      side: a.kind === "CAPACITY" ? a.sides![0] : undefined,
      value: defaultValueFor(attrId, op),
    });
  };

  const onOp = (op: Op) => onChange({ ...binding, op, value: defaultValueFor(binding.attribute, op) });
  const set = (patch: Partial<Binding>) => onChange({ ...binding, ...patch });

  return (
    <div className="effect-row">
      <div className="er-line">
        {/* The one picklist in the whole product */}
        <select
          className="er-attr"
          value={binding.attribute}
          onChange={(e) => onAttr(e.target.value)}
        >
          {REGISTRY.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>

        <select className="er-op" value={binding.op} onChange={(e) => onOp(e.target.value as Op)}>
          {legalOps.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        {attr.kind === "CAPACITY" && (
          <select
            className="er-side"
            value={binding.side ?? attr.sides![0]}
            onChange={(e) => set({ side: e.target.value as any })}
          >
            {attr.sides!.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        <ValueField binding={binding} set={set} />

        <button className="icon-btn danger" onClick={onRemove} title="Remove effect">
          ✕
        </button>
      </div>

      <div className="er-line secondary">
        <select
          className="er-scope"
          value={binding.scope ?? "PERMANENT"}
          onChange={(e) =>
            set({ scope: e.target.value === "PERMANENT" ? undefined : (e.target.value as Scope) })
          }
        >
          {SCOPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {(binding.scope === "CONDITIONAL") && (
          <input
            className="er-cond"
            placeholder="condition e.g. hazardousCelestial"
            value={binding.condition ? Object.values(binding.condition)[0] ?? "" : ""}
            onChange={(e) => set({ condition: { environment: e.target.value } })}
          />
        )}
        <input
          className="er-note"
          placeholder="note / provenance"
          value={binding.note ?? ""}
          onChange={(e) => set({ note: e.target.value })}
        />
      </div>
    </div>
  );
}

function ValueField({
  binding,
  set,
}: {
  binding: Binding;
  set: (patch: Partial<Binding>) => void;
}) {
  const attr = REGISTRY_BY_ID[binding.attribute];

  // CATEGORICAL: SET picks from the scale; SHIFT is a numeric step
  if (attr.kind === "CATEGORICAL") {
    if (binding.op === "SET_CATEGORICAL") {
      return (
        <select
          className="er-val"
          value={String(binding.value)}
          onChange={(e) => set({ value: e.target.value })}
        >
          {attr.scale!.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        className="er-val num"
        type="number"
        value={Number(binding.value) || 0}
        onChange={(e) => set({ value: Number(e.target.value) })}
      />
    );
  }

  // SLOTSET: mount dropdown + count
  if (attr.kind === "SLOTSET") {
    const rec = (binding.value && typeof binding.value === "object" ? binding.value : {}) as Record<
      string,
      number
    >;
    const mount = Object.keys(rec)[0] ?? attr.mounts![0];
    const count = rec[mount] ?? 1;
    return (
      <>
        <select
          className="er-val"
          value={mount}
          onChange={(e) => set({ value: { [e.target.value]: count } })}
        >
          {attr.mounts!.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="er-val num narrow"
          type="number"
          value={count}
          onChange={(e) => set({ value: { [mount]: Number(e.target.value) } })}
        />
      </>
    );
  }

  // LIST
  if (attr.kind === "LIST") {
    const v = (binding.value && typeof binding.value === "object" ? binding.value : {}) as any;
    if (attr.id === "skillMods") {
      return (
        <>
          <input
            className="er-val"
            placeholder="test (e.g. Pilot)"
            value={v.label ?? ""}
            onChange={(e) => set({ value: { ...v, label: e.target.value } })}
          />
          <input
            className="er-val num narrow"
            type="number"
            placeholder="mod"
            value={Number(v.mod) || 0}
            onChange={(e) => set({ value: { ...v, mod: Number(e.target.value) } })}
          />
          <input
            className="er-val"
            placeholder="condition"
            value={v.condition ?? ""}
            onChange={(e) => set({ value: { ...v, condition: e.target.value } })}
          />
        </>
      );
    }
    return (
      <>
        <input
          className="er-val"
          placeholder="label"
          value={v.label ?? ""}
          onChange={(e) => set({ value: { ...v, label: e.target.value } })}
        />
        <input
          className="er-val"
          placeholder="note"
          value={v.note ?? ""}
          onChange={(e) => set({ value: { ...v, note: e.target.value } })}
        />
      </>
    );
  }

  // CAPACITY / POOL / SCALAR -> numeric
  return (
    <input
      className="er-val num"
      type="number"
      value={Number(binding.value) || 0}
      onChange={(e) => set({ value: Number(e.target.value) })}
    />
  );
}
