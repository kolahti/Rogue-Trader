import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createShip } from "../api/ships";

export function HomePage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    createShip()
      .then(({ id }) => {
        if (!cancelled) navigate(`/s/${id}`, { replace: true });
      })
      .catch(() => {
        if (cancelled) return;
        setError(
          "Could not create a ship. Make sure you ran npm run dev (starts both Vite and the API on port 3001)."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="page-state">
        <div className="page-state-card">
          <h1>Could not start</h1>
          <p className="muted">{error}</p>
          <div className="page-state-actions">
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-state">
      <div className="page-state-card">
        <h1>VOIDSHIP FORGE</h1>
        <p className="muted">Creating a new ship…</p>
      </div>
    </div>
  );
}
