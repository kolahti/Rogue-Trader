import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBuilder } from "../store/builderStore";
import { compute } from "../engine/compute";
import { createShip, saveShip } from "../api/ships";
import { ElementPalette } from "./ElementPalette";
import { BuilderCanvas } from "./BuilderCanvas";
import { SummaryView } from "./SummaryView";
import { PropertyInspector } from "./PropertyInspector";
import { BreakdownInspector } from "./BreakdownInspector";

export function ShipEditor({ shipId }: { shipId: string }) {
  const navigate = useNavigate();
  const sheet = useBuilder((s) => s.sheet);
  const shipName = sheet.name;
  const setShipName = useBuilder((s) => s.setShipName);
  const undo = useBuilder((s) => s.undo);
  const redo = useBuilder((s) => s.redo);
  const reset = useBuilder((s) => s.reset);
  const loadBlank = useBuilder((s) => s.loadBlank);
  const canUndo = useBuilder((s) => s.past.length > 0);
  const canRedo = useBuilder((s) => s.future.length > 0);
  const breakdownAttr = useBuilder((s) => s.breakdownAttr);
  const isPlayMode = useBuilder((s) => s.isPlayMode);
  const setPlayMode = useBuilder((s) => s.setPlayMode);
  const isDirty = useBuilder((s) => s.isDirty);
  const saveStatus = useBuilder((s) => s.saveStatus);
  const setSaveStatus = useBuilder((s) => s.setSaveStatus);
  const markSaved = useBuilder((s) => s.markSaved);
  const [copyHint, setCopyHint] = useState("");

  const result = useMemo(() => compute(sheet), [sheet]);

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await saveShip(shipId, sheet);
      markSaved();
    } catch {
      setSaveStatus("error");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyHint("Copied!");
      window.setTimeout(() => setCopyHint(""), 2000);
    } catch {
      setCopyHint("Copy failed");
      window.setTimeout(() => setCopyHint(""), 2000);
    }
  };

  const handleNewShip = async () => {
    if (isDirty && !window.confirm("You have unsaved changes. Create a new ship anyway?")) return;
    try {
      const { id } = await createShip();
      navigate(`/s/${id}`);
    } catch {
      window.alert("Could not create a new ship. Is the API server running?");
    }
  };

  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "error"
        ? "Save failed"
        : isDirty
          ? "Save"
          : "Saved";

  return (
    <div className={"app" + (isPlayMode ? " play-mode" : "")}>
      <header className="topbar">
        <div className="brand">
          <span className="sigil">✠</span>
          <div>
            <div className="brand-title">VOIDSHIP FORGE</div>
            <div className="brand-sub">
              {isPlayMode ? "ship sheet · play mode" : "custom-authoring studio · shareable sheets"}
            </div>
          </div>
        </div>
        {isPlayMode ? (
          <div className="ship-name ship-name-readonly" aria-label="Ship name">
            {shipName}
          </div>
        ) : (
          <input
            className="ship-name"
            value={shipName}
            onChange={(e) => setShipName(e.target.value)}
            aria-label="Ship name"
          />
        )}
        <div className="toolbar">
          <div className="mode-toggle" role="group" aria-label="View mode">
            <button
              className={!isPlayMode ? "active" : ""}
              onClick={() => setPlayMode(false)}
              aria-pressed={!isPlayMode}
            >
              Build
            </button>
            <button
              className={isPlayMode ? "active" : ""}
              onClick={() => setPlayMode(true)}
              aria-pressed={isPlayMode}
            >
              Play
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={!isDirty || saveStatus === "saving"}
            className={isDirty ? "" : "ghost"}
            title={isDirty ? "Save ship to server" : "All changes saved"}
          >
            {saveLabel}
          </button>
          <button onClick={handleCopyLink} className="ghost" title="Copy shareable link">
            {copyHint || "Copy link"}
          </button>
          <button onClick={handleNewShip} className="ghost">
            New ship
          </button>
          {!isPlayMode && (
            <>
              <button onClick={undo} disabled={!canUndo} title="Undo">
                ↶ Undo
              </button>
              <button onClick={redo} disabled={!canRedo} title="Redo">
                ↷ Redo
              </button>
              <button onClick={loadBlank} className="ghost">
                Blank
              </button>
              <button onClick={reset} className="ghost">
                Reset demo
              </button>
            </>
          )}
        </div>
      </header>

      {isDirty && saveStatus !== "saving" && (
        <div className="save-banner" role="status">
          Unsaved changes — click Save to update the shared sheet.
        </div>
      )}

      <main className={"columns" + (isPlayMode ? " play-mode" : "")}>
        {!isPlayMode && (
          <aside className="col col-left">
            <ElementPalette />
          </aside>
        )}

        <section className="col col-center">
          {!isPlayMode && <BuilderCanvas />}
          <SummaryView result={result} readOnly={isPlayMode} />
        </section>

        {!isPlayMode && (
          <aside className="col col-right">
            <PropertyInspector />
          </aside>
        )}
      </main>

      {!isPlayMode && breakdownAttr && (
        <BreakdownInspector attr={breakdownAttr} result={result} />
      )}
    </div>
  );
}
