import { useEffect, useRef } from "react";
import type { ComputeResult } from "../engine/types";
import { labelOf } from "../engine/registry";
import { useBuilder } from "../store/builderStore";

// "Why is Morale 97?" — the ordered binding trace for one attribute (§2.1).
export function BreakdownInspector({
  attr,
  result,
}: {
  attr: string;
  result: ComputeResult;
}) {
  const close = () => useBuilder.getState().openBreakdown(null);
  const entries = result.trace[attr] ?? [];
  const s = result.summary[attr];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="breakdown-title"
      >
        <div className="modal-head">
          <h3 id="breakdown-title">Breakdown · {labelOf(attr)}</h3>
          <button className="icon-btn" onClick={close} ref={closeRef} aria-label="Close breakdown">✕</button>
        </div>

        <div className="modal-summary">{describe(s)}</div>

        {entries.length === 0 ? (
          <p className="muted">No bindings target this attribute.</p>
        ) : (
          <table className="trace-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Type</th>
                <th>Op</th>
                <th>Side</th>
                <th>Value</th>
                <th>Scope</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className={e.scope && e.scope !== "PERMANENT" ? "conditional" : ""}>
                  <td>{e.source}</td>
                  <td>{e.type_}</td>
                  <td><code>{e.op}</code></td>
                  <td>{e.side ?? "—"}</td>
                  <td>{fmt(e.value)}</td>
                  <td>{e.scope ?? "PERMANENT"}</td>
                  <td className="muted">{e.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function describe(s: any): string {
  if (!s) return "";
  switch (s.kind) {
    case "CAPACITY":
      return `${s.total} total / ${s.second} ${s.secondLabel}${
        s.secondLabel === "consumed" ? ` → ${s.spare} spare` : ""
      }`;
    case "POOL":
      return `${s.current} / ${s.max} max`;
    case "SCALAR":
      return `Value: ${s.value}`;
    case "CATEGORICAL":
      return `Label: ${s.label}`;
    case "SLOTSET":
      return Object.entries(s.mounts)
        .map(([m, v]: any) => `${m} ${v.used}/${v.total}`)
        .join(" · ");
    case "LIST":
      return `${s.entries.length} entr${s.entries.length === 1 ? "y" : "ies"}`;
    default:
      return "";
  }
}

function fmt(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
