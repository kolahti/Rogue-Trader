import type { AttrSummary, ComputeResult } from "../engine/types";
import { REGISTRY, labelOf } from "../engine/registry";
import { useBuilder } from "../store/builderStore";

export function SummaryView({
  result,
  readOnly = false,
}: {
  result: ComputeResult;
  readOnly?: boolean;
}) {
  const { summary, diagnostics } = result;
  const openBreakdown = useBuilder((s) => s.openBreakdown);

  return (
    <div className={"summary" + (readOnly ? " summary-play" : "")}>
      <h2 className="col-title">{readOnly ? "Ship Sheet" : "Live Summary"}</h2>

      {diagnostics.length > 0 && (
        <div className="diagnostics">
          {diagnostics.map((d, i) => (
            <div key={i} className={"diag " + d.level}>
              <span className="diag-dot" />
              <span>{d.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="summary-grid">
        {REGISTRY.map((attr) => {
          const s = summary[attr.id];
          if (!s) return null;
          const panelClass =
            "sum-panel k-" + s.kind.toLowerCase() + panelState(s) + (readOnly ? " read-only" : "");
          const body = (
            <>
              <div className="sum-label">{labelOf(attr.id)}</div>
              <PanelBody s={s} />
            </>
          );
          return readOnly ? (
            <div key={attr.id} className={panelClass}>
              {body}
            </div>
          ) : (
            <button
              key={attr.id}
              className={panelClass}
              onClick={() => openBreakdown(attr.id)}
              title="Why this value? Open the binding trace"
            >
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function panelState(s: AttrSummary): string {
  if (s.kind === "CAPACITY" && s.secondLabel === "consumed") {
    if (s.spare < 0) return " error";
    if (s.spare <= 1) return " warn";
  }
  if (s.kind === "SLOTSET") {
    for (const v of Object.values(s.mounts)) if (v.used > v.total) return " error";
  }
  return "";
}

function PanelBody({ s }: { s: AttrSummary }) {
  switch (s.kind) {
    case "CAPACITY": {
      const pct = s.total > 0 ? Math.min(100, (s.second / s.total) * 100) : 0;
      const showSpare = s.secondLabel === "consumed";
      return (
        <>
          <div className="bar">
            <div className="bar-fill" style={{ width: pct + "%" }} />
          </div>
          <div className="sum-value">
            {s.total} total / {s.second} {s.secondLabel}
            {showSpare && <span className="spare"> → {s.spare} spare</span>}
          </div>
        </>
      );
    }
    case "POOL": {
      const pct = s.max > 0 ? Math.min(100, (s.current / s.max) * 100) : 0;
      return (
        <>
          <div className="bar pool">
            <div className="bar-fill" style={{ width: pct + "%" }} />
          </div>
          <div className="sum-value">
            {s.current} / {s.max} max
          </div>
        </>
      );
    }
    case "SCALAR":
      return <div className="sum-value big">{round(s.value)}</div>;
    case "CATEGORICAL":
      return (
        <div className="sum-value">
          <span className="chip">{s.label}</span>
          <span className="scale-hint">{s.scale.join(" · ")}</span>
        </div>
      );
    case "SLOTSET":
      return (
        <div className="slots">
          {Object.entries(s.mounts).map(([m, v]) => (
            <span key={m} className={"slot" + (v.used > v.total ? " over" : "")}>
              {m} {v.used}/{v.total}
            </span>
          ))}
        </div>
      );
    case "LIST":
      return s.entries.length === 0 ? (
        <div className="sum-value muted">—</div>
      ) : (
        <ul className="list-entries">
          {s.entries.map((e, i) => (
            <li key={i}>
              {e.label}
              {typeof e.mod === "number" ? ` +${e.mod}` : ""}
              {e.condition ? <span className="cond"> · {e.condition}</span> : ""}
              <span className="prov"> ({e.source})</span>
            </li>
          ))}
        </ul>
      );
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
