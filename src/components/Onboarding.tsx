import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "vf_onboarded";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

// First-run explainer for the custom-authoring mental model. Reopens via the
// toolbar "?" button. Dismissal is remembered in localStorage.
export function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const closeRef = useRef<HTMLButtonElement>(null);
  const visible = open || !dismissed;

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore — onboarding will simply reappear next session */
    }
    setDismissed(true);
    onClose();
  };

  useEffect(() => {
    if (!visible) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal onboarding"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className="modal-head">
          <h3 id="onboarding-title">How Voidship Forge works</h3>
          <button className="icon-btn" onClick={close} ref={closeRef} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="onboarding-lead">
          You invent every part of the ship. Nothing is pre-built except the list of attributes an
          effect can change.
        </p>
        <ol className="onboarding-steps">
          <li>
            <strong>Author a part</strong> from the left — a component, machine spirit, ability, or
            trait. They all share one form.
          </li>
          <li>
            <strong>Add effects</strong> on the right. Each effect points at an attribute (Power,
            Morale, Speed…) and says what it does to it.
          </li>
          <li>
            <strong>Watch the Summary</strong> on the far right recompute instantly. Click any panel
            to see <em>why</em> a number is what it is.
          </li>
        </ol>
        <div className="page-state-actions">
          <button className="primary" onClick={close}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
