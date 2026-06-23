import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBuilder } from "../store/builderStore";
import { compute } from "../engine/compute";
import { isShipConfig } from "../engine/validate";
import { createShip, saveShip } from "../api/ships";
import { ElementPalette } from "./ElementPalette";
import { BuilderCanvas } from "./BuilderCanvas";
import { SummaryView } from "./SummaryView";
import { PropertyInspector } from "./PropertyInspector";
import { BreakdownInspector } from "./BreakdownInspector";
import { Onboarding } from "./Onboarding";

export function ShipEditor({ shipId }: { shipId: string }) {
  const navigate = useNavigate();
  const sheet = useBuilder((s) => s.sheet);
  const shipName = sheet.name;
  const setShipName = useBuilder((s) => s.setShipName);
  const undo = useBuilder((s) => s.undo);
  const redo = useBuilder((s) => s.redo);
  const importSheet = useBuilder((s) => s.importSheet);
  const canUndo = useBuilder((s) => s.past.length > 0);
  const canRedo = useBuilder((s) => s.future.length > 0);
  const breakdownAttr = useBuilder((s) => s.breakdownAttr);
  const isPlayMode = useBuilder((s) => s.isPlayMode);
  const setPlayMode = useBuilder((s) => s.setPlayMode);
  const isDirty = useBuilder((s) => s.isDirty);
  const saveStatus = useBuilder((s) => s.saveStatus);
  const setSaveStatus = useBuilder((s) => s.setSaveStatus);
  const markSaved = useBuilder((s) => s.markSaved);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => compute(sheet), [sheet]);

  const handleSave = async () => {
    if (!isDirty || saveStatus === "saving") return;
    setSaveStatus("saving");
    try {
      await saveShip(shipId, sheet);
      markSaved();
    } catch {
      setSaveStatus("error");
    }
  };

  const handleExport = () => {
    setMenuOpen(false);
    const blob = new Blob([JSON.stringify(sheet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(sheet.name || "voidship").trim() || "voidship"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    if (isDirty && !window.confirm("Discard the current local sheet and import this file?")) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isShipConfig(parsed)) {
        window.alert("That file is not a valid ship export.");
        return;
      }
      importSheet(parsed);
    } catch {
      window.alert("Could not read that file — it is not valid JSON.");
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

  // Close the overflow menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Keyboard shortcuts: ⌘/Ctrl+S save, ⌘/Ctrl+Z undo, ⌘/Ctrl+Shift+Z redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        void handleSave();
        return;
      }
      const target = e.target as HTMLElement | null;
      const inField =
        target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (inField || isPlayMode) return;
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlayMode, isDirty, saveStatus, sheet]);

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
            className={isDirty ? "primary" : "ghost"}
            title={isDirty ? "Save ship (⌘S)" : "All changes saved"}
          >
            {saveLabel}
          </button>

          <div className="toolbar-group">
            <button onClick={handleNewShip} className="ghost">
              New ship
            </button>
          </div>

          {!isPlayMode && (
            <>
              <div className="toolbar-group">
                <button onClick={undo} disabled={!canUndo} title="Undo (⌘Z)" aria-label="Undo">
                  ↶
                </button>
                <button onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)" aria-label="Redo">
                  ↷
                </button>
              </div>

              <div className="overflow" ref={menuRef}>
                <button
                  className="ghost"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="More actions"
                >
                  ⋯
                </button>
                {menuOpen && (
                  <div className="overflow-menu" role="menu">
                    <button role="menuitem" onClick={handleExport}>
                      Export JSON
                    </button>
                    <button role="menuitem" onClick={() => fileInputRef.current?.click()}>
                      Import JSON…
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <button
            className="ghost icon-help"
            onClick={() => setShowHelp(true)}
            title="How this works"
            aria-label="Help"
          >
            ?
          </button>
        </div>
      </header>

      {isDirty && saveStatus !== "saving" && (
        <div className="save-banner" role="status">
          Unsaved changes — click Save (⌘S) to update the shared sheet.
        </div>
      )}

      <main className={"columns" + (isPlayMode ? " play-mode" : " build-mode")}>
        {!isPlayMode && (
          <aside className="col col-left">
            <ElementPalette />
          </aside>
        )}

        {!isPlayMode && (
          <section className="col col-center">
            <BuilderCanvas />
          </section>
        )}

        {!isPlayMode && (
          <aside className="col col-right">
            <PropertyInspector />
          </aside>
        )}

        <aside className="col col-summary">
          <SummaryView result={result} readOnly={isPlayMode} />
        </aside>
      </main>

      {!isPlayMode && breakdownAttr && (
        <BreakdownInspector attr={breakdownAttr} result={result} />
      )}

      <Onboarding open={showHelp} onClose={() => setShowHelp(false)} />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFile}
        style={{ display: "none" }}
        aria-hidden="true"
      />
    </div>
  );
}
