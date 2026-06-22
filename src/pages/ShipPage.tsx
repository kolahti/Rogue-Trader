import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadShip, ShipApiError } from "../api/ships";
import { ShipEditor } from "../components/ShipEditor";
import { useBuilder } from "../store/builderStore";

export function ShipPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loadSheet = useBuilder((s) => s.loadSheet);
  const loadedId = useBuilder((s) => s.shipId);
  const setSaveStatus = useBuilder((s) => s.setSaveStatus);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate("/", { replace: true });
      return;
    }

    if (loadedId === id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaveStatus("loading");

    loadShip(id)
      .then((sheet) => {
        if (cancelled) return;
        loadSheet(sheet, id);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ShipApiError && err.status === 404) {
          setError("This ship link is invalid or the sheet was deleted.");
        } else {
          setError("Could not load this ship. Check your connection and try again.");
        }
        setSaveStatus("error");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, loadedId, loadSheet, navigate, setSaveStatus]);

  if (loading) {
    return (
      <div className="page-state">
        <div className="page-state-card">
          <h1>Loading ship</h1>
          <p className="muted">Fetching sheet…</p>
        </div>
      </div>
    );
  }

  if (error || !id) {
    return (
      <div className="page-state">
        <div className="page-state-card">
          <h1>Ship not found</h1>
          <p className="muted">{error ?? "Unknown error"}</p>
          <div className="page-state-actions">
            <button onClick={() => navigate("/")}>Create new ship</button>
            <button className="ghost" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <ShipEditor shipId={id} />;
}
