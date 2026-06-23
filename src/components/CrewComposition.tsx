import { useMemo } from "react";
import { useBuilder } from "../store/builderStore";
import { compute } from "../engine/compute";

// Crew composition editor + the live current-population control. The hull seeds
// the population maximum (total); this lets you set the live headcount for play.
export function CrewComposition() {
  const sheet = useBuilder((s) => s.sheet);
  const crew = sheet.crewComposition;
  const initCrew = useBuilder((s) => s.initCrew);
  const addCrewGroup = useBuilder((s) => s.addCrewGroup);
  const updateCrewGroup = useBuilder((s) => s.updateCrewGroup);
  const removeCrewGroup = useBuilder((s) => s.removeCrewGroup);
  const setCurrentValue = useBuilder((s) => s.setCurrentValue);

  const result = useMemo(() => compute(sheet), [sheet]);
  const pop = result.summary["population"];
  const popTotal = pop && pop.kind === "CAPACITY" ? pop.total : 0;
  const popCurrent = pop && pop.kind === "CAPACITY" ? pop.second : 0;
  const popTracked = sheet.current?.["population"] != null;
  const clampPop = (v: number) => Math.max(0, Math.min(popTotal, v));

  return (
    <div className="crew">
      <h2 className="col-title">Crew Composition</h2>

      <div className="crew-pop">
        <label htmlFor="pop-current">Current population</label>
        <input
          id="pop-current"
          type="number"
          min={0}
          max={popTotal}
          value={popCurrent}
          onChange={(e) => setCurrentValue("population", clampPop(Number(e.target.value)))}
        />
        <span className="cs-max">/ {popTotal} total</span>
        <button
          className="ghost cs-reset"
          onClick={() => setCurrentValue("population", null)}
          disabled={!popTracked}
          title="Reset to full"
        >
          Reset
        </button>
      </div>

      {!crew ? (
        <>
          <p className="hint">Optional — divide the crew into groups whose shares sum to 100%.</p>
          <button onClick={initCrew}>+ Add crew composition</button>
        </>
      ) : (
        <>
          <div className="crew-rows">
            {crew.groups.map((g, i) => (
              <div className="crew-row" key={i}>
                <input
                  className="crew-name"
                  value={g.name}
                  onChange={(e) => updateCrewGroup(i, { name: e.target.value })}
                  aria-label="Crew group name"
                />
                <div className="crew-share">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={g.sharePct}
                    onChange={(e) => updateCrewGroup(i, { sharePct: Number(e.target.value) })}
                    aria-label="Share percent"
                  />
                  <span>%</span>
                </div>
                <button
                  className="icon-btn danger"
                  onClick={() => removeCrewGroup(i)}
                  title="Remove group"
                  aria-label="Remove crew group"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {(() => {
            const total = crew.groups.reduce((a, g) => a + g.sharePct, 0);
            const balanced = total === 100;
            return (
              <div className={"crew-total" + (balanced ? "" : " unbalanced")} role="status">
                <span>Total</span>
                <span className="crew-total-value">{total}%</span>
                {!balanced && <span className="crew-total-hint">should be 100%</span>}
              </div>
            );
          })()}
          <button className="ghost crew-add" onClick={addCrewGroup}>
            + Add group
          </button>
        </>
      )}
    </div>
  );
}
