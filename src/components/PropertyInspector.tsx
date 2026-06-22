import { useBuilder } from "../store/builderStore";
import { REGISTRY, OPS_BY_KIND } from "../engine/registry";
import type { Binding } from "../engine/types";
import { EffectRow } from "./EffectRow";

// Default binding when "Add Effect" is clicked: points at the first attribute.
function newBinding(): Binding {
  const attr = REGISTRY[0];
  return { attribute: attr.id, op: OPS_BY_KIND[attr.kind][0], side: attr.sides?.[0], value: 0 };
}

export function PropertyInspector() {
  const sheet = useBuilder((s) => s.sheet);
  const selectedId = useBuilder((s) => s.selectedId);
  const updateElementMeta = useBuilder((s) => s.updateElementMeta);
  const addBinding = useBuilder((s) => s.addBinding);
  const updateBinding = useBuilder((s) => s.updateBinding);
  const removeBinding = useBuilder((s) => s.removeBinding);

  const el = selectedId === "hull" ? sheet.hull : sheet.elements.find((e) => e.id === selectedId);

  if (!el) {
    return (
      <div className="inspector empty-inspector">
        <h2 className="col-title">Inspector</h2>
        <p className="hint">Select the Hull or an Element to author it.</p>
      </div>
    );
  }

  const isHull = el.id === "hull";
  const id = el.id;

  return (
    <div className="inspector">
      <h2 className="col-title">Inspector · {el.type_}</h2>

      <label className="field">
        <span>Name</span>
        <input value={el.name} onChange={(e) => updateElementMeta(id, { name: e.target.value })} />
      </label>

      {!isHull && (
        <label className="field">
          <span>Type / subtype (free text)</span>
          <input
            value={el.subtype ?? ""}
            placeholder="e.g. Essential, Weapon, Supplemental"
            onChange={(e) => updateElementMeta(id, { subtype: e.target.value })}
          />
        </label>
      )}

      <label className="field">
        <span>Description</span>
        <textarea
          value={el.description ?? ""}
          rows={2}
          onChange={(e) => updateElementMeta(id, { description: e.target.value })}
        />
      </label>

      <div className="effects-head">
        <span>Effects {isHull ? "(seed the base values)" : ""}</span>
        <button className="add-effect" onClick={() => addBinding(id, newBinding())}>
          + Add Effect
        </button>
      </div>

      {el.bindings.length === 0 && <p className="hint">No effects yet.</p>}

      <div className="effect-rows">
        {el.bindings.map((b, i) => (
          <EffectRow
            key={i}
            binding={b}
            onChange={(nb) => updateBinding(id, i, nb)}
            onRemove={() => removeBinding(id, i)}
          />
        ))}
      </div>
    </div>
  );
}
