import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createShip } from "../api/ships";

export function HomePage() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;
    createShip()
      .then(({ id }) => {
        if (!cancelled) navigate(`/s/${id}`, { replace: true });
      })
      .catch(() => {
        if (!cancelled) navigate("/error", { replace: true, state: { message: "Could not create a ship." } });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="page-state">
      <div className="page-state-card">
        <h1>VOIDSHIP FORGE</h1>
        <p className="muted">Creating a new ship…</p>
      </div>
    </div>
  );
}
