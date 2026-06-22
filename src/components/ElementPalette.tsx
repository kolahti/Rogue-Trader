import type { ElementType } from "../engine/types";
import { useBuilder } from "../store/builderStore";

const TYPES: { type_: ElementType; blurb: string }[] = [
  { type_: "Component", blurb: "Generators, drives, weapons, shrines…" },
  { type_: "PastHistory", blurb: "Where the ship has been" },
  { type_: "MachineSpirit", blurb: "Quirks of the cogitator soul" },
  { type_: "Ability", blurb: "Granted combat actions" },
  { type_: "Trait", blurb: "Standing characteristics" },
  { type_: "Achievement", blurb: "Honours earned" },
];

export function ElementPalette() {
  const addElement = useBuilder((s) => s.addElement);
  const selectHull = () => useBuilder.getState().select("hull");

  return (
    <div className="palette">
      <h2 className="col-title">Author</h2>
      <p className="hint">
        Everything is the same shape: a named, typed container with effect rows. Click to create one.
      </p>

      <button className="palette-item hull-item" onClick={selectHull}>
        <span className="pi-name">Hull</span>
        <span className="pi-blurb">Edit the hand-entered base numbers</span>
      </button>

      <div className="palette-list">
        {TYPES.map((t) => (
          <button key={t.type_} className="palette-item" onClick={() => addElement(t.type_)}>
            <span className="pi-name">+ {t.type_}</span>
            <span className="pi-blurb">{t.blurb}</span>
          </button>
        ))}
      </div>

      <div className="palette-note">
        <strong>The one fixed thing</strong> is the Attribute Registry — the only picklist in the
        product. Every effect you add must point at one of its attributes.
      </div>
    </div>
  );
}
