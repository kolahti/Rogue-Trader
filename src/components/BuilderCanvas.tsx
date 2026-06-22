import { useState } from "react";
import { useBuilder } from "../store/builderStore";
import type { Element } from "../engine/types";

export function BuilderCanvas() {
  const sheet = useBuilder((s) => s.sheet);
  const selectedId = useBuilder((s) => s.selectedId);
  const select = useBuilder((s) => s.select);
  const toggleElement = useBuilder((s) => s.toggleElement);
  const removeElement = useBuilder((s) => s.removeElement);
  const reorderElement = useBuilder((s) => s.reorderElement);

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div className="canvas">
      <h2 className="col-title">Sheet</h2>

      <button
        className={"hull-card" + (selectedId === "hull" ? " selected" : "")}
        onClick={() => select("hull")}
      >
        <div className="card-head">
          <span className="type-badge hull">HULL</span>
          <span className="card-name">{sheet.hull.name}</span>
        </div>
        <span className="card-meta">{sheet.hull.bindings.length} base bindings</span>
      </button>

      <div className="element-list">
        {sheet.elements.length === 0 && (
          <div className="empty">No elements yet — author one from the left.</div>
        )}
        {sheet.elements.map((el: Element, i) => (
          <div
            key={el.id}
            className={
              "element-card" +
              (selectedId === el.id ? " selected" : "") +
              (el.enabled ? "" : " disabled") +
              (dragIndex === i ? " dragging" : "")
            }
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) reorderElement(dragIndex, i);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            onClick={() => select(el.id)}
          >
            <span className="drag-grip" title="Drag to reorder">⋮⋮</span>
            <input
              type="checkbox"
              checked={el.enabled}
              onChange={(e) => {
                e.stopPropagation();
                toggleElement(el.id);
              }}
              onClick={(e) => e.stopPropagation()}
              title="Enable / disable"
            />
            <div className="card-body">
              <div className="card-head">
                <span className={"type-badge t-" + el.type_}>{el.type_}</span>
                <span className="card-name">{el.name}</span>
              </div>
              <span className="card-meta">
                {el.subtype ? el.subtype + " · " : ""}
                {el.bindings.length} effect{el.bindings.length === 1 ? "" : "s"}
              </span>
            </div>
            <button
              className="icon-btn danger"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                removeElement(el.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
