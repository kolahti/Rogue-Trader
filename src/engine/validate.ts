import type { Element, ShipConfig } from "./types";

// ---------------------------------------------------------------------------
// Client-side structural guard for imported ShipConfig JSON.
// Mirrors the shape checks in lib/ships-core.js (the server's validateSheet),
// kept on the TS side of the JS/TS boundary so it can be typed and bundled for
// the browser. The server still applies the authoritative version check on save.
// ---------------------------------------------------------------------------

function isElement(x: unknown): x is Element {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.type_ === "string" &&
    typeof e.name === "string" &&
    Array.isArray(e.bindings)
  );
}

export function isShipConfig(x: unknown): x is ShipConfig {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.name === "string" &&
    typeof s.schemaVersion === "number" &&
    typeof s.registryVersion === "number" &&
    isElement(s.hull) &&
    Array.isArray(s.elements) &&
    s.elements.every(isElement)
  );
}
