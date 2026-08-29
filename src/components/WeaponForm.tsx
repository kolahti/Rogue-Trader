import type { Element, WeaponSpec } from "../engine/types";
import { REGISTRY_BY_ID } from "../engine/registry";
import { useBuilder } from "../store/builderStore";

// Purpose-built editor for a Weapon-class component. Owns exactly two bindings —
// weaponSlots OCCUPY (mount + slots) and weapons GRANT (damage/crit/range/special)
// — which it upserts through setWeaponSpec. Other effect rows (Power/Space cost)
// stay in the generic editor below it.

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function readSpec(el: Element, mounts: string[]): WeaponSpec {
  const occupy = el.bindings.find((b) => b.attribute === "weaponSlots" && b.op === "OCCUPY");
  const grant = el.bindings.find((b) => b.attribute === "weapons" && b.op === "GRANT");
  const rec = (occupy?.value && typeof occupy.value === "object" ? occupy.value : {}) as Record<
    string,
    number
  >;
  const mount = Object.keys(rec)[0] ?? mounts[0];
  const gv = (grant?.value && typeof grant.value === "object" ? grant.value : {}) as {
    strength?: number;
    damage?: string;
    crit?: number;
    rangeShort?: number;
    rangeMedium?: number;
    rangeLong?: number;
    special?: string;
  };
  return {
    strength: Number(gv.strength) || 0,
    damage: gv.damage ?? "",
    crit: Number(gv.crit) || 0,
    rangeShort: Number(gv.rangeShort) || 0,
    rangeMedium: Number(gv.rangeMedium) || 0,
    rangeLong: Number(gv.rangeLong) || 0,
    mount,
    slots: Number(rec[mount]) || 1,
    special: gv.special ?? "",
  };
}

export function WeaponForm({ el }: { el: Element }) {
  const setWeaponSpec = useBuilder((s) => s.setWeaponSpec);
  const mounts = REGISTRY_BY_ID["weaponSlots"].mounts ?? [];
  const spec = readSpec(el, mounts);
  const update = (patch: Partial<WeaponSpec>) => setWeaponSpec(el.id, { ...spec, ...patch });

  return (
    <div className="weapon-form">
      <h3 className="sub-title">Weapon</h3>

      <div className="weapon-stats">
        <label className="field">
          <span>Strength</span>
          <input
            type="number"
            value={spec.strength}
            onChange={(e) => update({ strength: num(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Damage</span>
          <input
            value={spec.damage}
            placeholder="e.g. 1d10+6"
            onChange={(e) => update({ damage: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Crit</span>
          <input
            type="number"
            value={spec.crit}
            onChange={(e) => update({ crit: num(e.target.value) })}
          />
        </label>
      </div>

      <div className="weapon-range">
        <label className="field">
          <span>Range · short</span>
          <input
            type="number"
            value={spec.rangeShort}
            onChange={(e) => update({ rangeShort: num(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Medium</span>
          <input
            type="number"
            value={spec.rangeMedium}
            onChange={(e) => update({ rangeMedium: num(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Long</span>
          <input
            type="number"
            value={spec.rangeLong}
            onChange={(e) => update({ rangeLong: num(e.target.value) })}
          />
        </label>
      </div>

      <div className="weapon-mount">
        <label className="field">
          <span>Weapon slot</span>
          <select value={spec.mount} onChange={(e) => update({ mount: e.target.value })}>
            {mounts.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Slots used</span>
          <input
            type="number"
            min={0}
            value={spec.slots}
            onChange={(e) => update({ slots: num(e.target.value) })}
          />
        </label>
      </div>

      <label className="field">
        <span>Special</span>
        <input
          value={spec.special}
          placeholder="e.g. Half range, Holy"
          onChange={(e) => update({ special: e.target.value })}
        />
      </label>
    </div>
  );
}
