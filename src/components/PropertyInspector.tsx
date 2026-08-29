import { useBuilder } from "../store/builderStore";
import {
  REGISTRY,
  OPS_BY_KIND,
  COMPONENT_SUBTYPES,
  COMPONENT_QUALITIES,
  COMPONENT_LOCATIONS,
  DEFAULT_COMPONENT_QUALITY,
} from "../engine/registry";
import type { Binding } from "../engine/types";
import { EffectRow } from "./EffectRow";
import { WeaponForm } from "./WeaponForm";

// Bindings the weapon form owns — hidden from the generic effect editor so the
// two never diverge.
const isWeaponBinding = (b: Binding): boolean =>
  (b.attribute === "weaponSlots" && b.op === "OCCUPY") ||
  (b.attribute === "weapons" && b.op === "GRANT");

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
  const addLink = useBuilder((s) => s.addLink);
  const updateLink = useBuilder((s) => s.updateLink);
  const removeLink = useBuilder((s) => s.removeLink);

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
  const isWeapon = el.type_ === "Component" && el.subtype === "Weapon";
  // Generic rows exclude the weapon-owned bindings; keep the real index for edits.
  const genericRows = el.bindings
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => !(isWeapon && isWeaponBinding(b)));

  return (
    <div className="inspector">
      <h2 className="col-title">Inspector · {el.type_}</h2>

      <label className="field">
        <span>Name</span>
        <input value={el.name} onChange={(e) => updateElementMeta(id, { name: e.target.value })} />
      </label>

      {el.type_ === "Component" && (
        <>
          <label className="field">
            <span>Class</span>
            <select
              value={el.subtype ?? ""}
              onChange={(e) => updateElementMeta(id, { subtype: e.target.value || undefined })}
            >
              <option value="">— Unclassified —</option>
              {COMPONENT_SUBTYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Quality</span>
            <select
              value={el.quality ?? DEFAULT_COMPONENT_QUALITY}
              onChange={(e) => updateElementMeta(id, { quality: e.target.value })}
            >
              {COMPONENT_QUALITIES.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Location</span>
            <select
              value={el.location ?? ""}
              onChange={(e) => updateElementMeta(id, { location: e.target.value || undefined })}
            >
              <option value="">— Unspecified —</option>
              {COMPONENT_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <label className="field">
        <span>Description</span>
        <textarea
          value={el.description ?? ""}
          rows={2}
          onChange={(e) => updateElementMeta(id, { description: e.target.value })}
        />
        <span className="field-hint">Markdown: **bold**, *italic*, `code`, [text](url), - lists, # headings</span>
      </label>

      <div className="effects-head">
        <span>Links</span>
        <button className="add-effect" onClick={() => addLink(id)}>
          + Add Link
        </button>
      </div>

      {(el.links?.length ?? 0) === 0 && (
        <p className="hint">No links yet. Each link shows its description in a popup in play view.</p>
      )}

      <div className="link-rows">
        {el.links?.map((link, i) => (
          <div className="link-row" key={i}>
            <div className="link-row-head">
              <input
                className="link-label"
                value={link.label}
                placeholder="Link text"
                onChange={(e) => updateLink(id, i, { label: e.target.value })}
              />
              <button
                className="icon-btn"
                onClick={() => removeLink(id, i)}
                aria-label="Remove link"
                title="Remove link"
              >
                ✕
              </button>
            </div>
            <textarea
              value={link.description}
              rows={2}
              placeholder="Popup description"
              onChange={(e) => updateLink(id, i, { description: e.target.value })}
            />
          </div>
        ))}
      </div>

      {isWeapon && <WeaponForm el={el} />}

      <div className="effects-head">
        <span>
          {isHull
            ? "Effects (seed the base values)"
            : isWeapon
              ? "Other effects (Power / Space cost)"
              : "Effects"}
        </span>
        <button className="add-effect" onClick={() => addBinding(id, newBinding())}>
          + Add Effect
        </button>
      </div>

      {genericRows.length === 0 && <p className="hint">No effects yet.</p>}

      <div className="effect-rows">
        {genericRows.map(({ b, i }) => (
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
