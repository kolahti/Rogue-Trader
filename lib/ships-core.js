import { randomBytes } from "node:crypto";

export const SCHEMA_VERSION = 2;
export const REGISTRY_VERSION = 2;

export function blankSheet(id) {
  return {
    id,
    name: "Untitled Voidship",
    schemaVersion: SCHEMA_VERSION,
    registryVersion: REGISTRY_VERSION,
    hull: {
      id: "hull",
      type_: "Hull",
      name: "New Hull",
      description: "Enter your hull's raw base numbers as effect rows.",
      enabled: true,
      bindings: [
        { attribute: "space", side: "total", op: "ADD", value: 0 },
        { attribute: "shipPoints", side: "total", op: "ADD", value: 0 },
        { attribute: "power", side: "total", op: "ADD", value: 0 },
        { attribute: "population", side: "total", op: "ADD", value: 0 },
        { attribute: "morale", op: "SET_MAX", value: 100 },
      ],
    },
    elements: [],
  };
}

export function generateId() {
  return "ship_" + randomBytes(8).toString("base64url");
}

export function isValidShipId(id) {
  return typeof id === "string" && /^ship_[a-zA-Z0-9_-]+$/.test(id);
}

export function shipPathname(id) {
  return `ships/${id}.json`;
}

export function validateSheet(sheet) {
  if (!sheet || typeof sheet !== "object") return "Invalid body";
  if (sheet.schemaVersion !== SCHEMA_VERSION) return "Unsupported schemaVersion";
  if (sheet.registryVersion !== REGISTRY_VERSION) return "Unsupported registryVersion";
  if (!sheet.hull || typeof sheet.hull !== "object") return "Invalid ShipConfig: missing hull";
  if (!Array.isArray(sheet.elements)) return "Invalid ShipConfig: elements must be an array";
  return null;
}
