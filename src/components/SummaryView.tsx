import type { AttrSummary, ComputeResult } from "../engine/types";
import { REGISTRY, REGISTRY_BY_ID, DASHBOARD_SECTIONS, labelOf } from "../engine/registry";
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
  const crew = useBuilder((s) => s.sheet.crewComposition);

  const renderPanel = (attrId: string) => {
    const attr = REGISTRY_BY_ID[attrId];
    const s = attr ? summary[attrId] : undefined;
    if (!attr || !s) return null;
    const panelClass =
      "sum-panel k-" + s.kind.toLowerCase() + panelState(s) + (readOnly ? " read-only" : "");
    const body = (
      <>
        <div className="sum-label">
          {attr.label}
          {!readOnly && <span className="sum-explain" aria-hidden="true">why?</span>}
        </div>
        <PanelBody s={s} id={attrId} />
      </>
    );
    return readOnly ? (
      <div key={attrId} className={panelClass}>
        {body}
      </div>
    ) : (
      <button
        key={attrId}
        className={panelClass}
        onClick={() => openBreakdown(attrId)}
        title="Why this value? Open the binding trace"
        aria-label={`${attr.label} — show breakdown of how this value is calculated`}
      >
        {body}
      </button>
    );
  };

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

      {readOnly ? (
        <div className="dashboard">
          {DASHBOARD_SECTIONS.map((sec) => {
            const panels = sec.attrs.map(renderPanel).filter(Boolean);
            if (panels.length === 0) return null;
            return (
              <section className="dash-section" key={sec.title}>
                <h3 className="dash-title">{sec.title}</h3>
                <div className="summary-grid">{panels}</div>
              </section>
            );
          })}

          {crew && crew.groups.length > 0 && (
            <section className="dash-section">
              <h3 className="dash-title">Crew Composition</h3>
              <div className="crew-readout">
                {crew.groups.map((g, i) => (
                  <div className="crew-readout-row" key={i}>
                    <span className="cr-name">{g.name}</span>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: Math.min(100, g.sharePct) + "%" }} />
                    </div>
                    <span className="cr-share">{g.sharePct}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="summary-grid">{REGISTRY.map((attr) => renderPanel(attr.id))}</div>
      )}
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

function PanelBody({ s, id }: { s: AttrSummary; id: string }) {
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
      // Morale has no meaningful maximum — show the current value alone.
      if (id === "morale") {
        return <div className="sum-value big">{round(s.current)}</div>;
      }
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
              {e.note ? <span className="entry-note"> — {e.note}</span> : ""}
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
