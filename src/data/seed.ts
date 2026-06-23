import type { ShipConfig } from "../engine/types";
import { REGISTRY_VERSION } from "../engine/registry";

// The self-contained sheet from §1.5 of the architecture document.
// Everything here is user-authored content — there is no catalog.
function makeSeed(): ShipConfig {
  return {
    id: "ship_8f21",
    name: "Wrath of the Von Ulm",
    schemaVersion: 2,
    registryVersion: REGISTRY_VERSION,
    hull: {
      id: "hull",
      type_: "Hull",
      name: "Sword-class Frigate (my variant)",
      description: "Hand-entered hull. Its bindings seed the base/total/max sides.",
      enabled: true,
      bindings: [
        { attribute: "space", side: "total", op: "ADD", value: 40 },
        { attribute: "shipPoints", side: "total", op: "ADD", value: 40 },
        { attribute: "power", side: "total", op: "ADD", value: 0 },
        { attribute: "population", side: "total", op: "ADD", value: 100 },
        { attribute: "hullIntegrity", op: "SET_MAX", value: 35 },
        { attribute: "morale", op: "SET_MAX", value: 100 },
        { attribute: "speed", op: "ADD", value: 8 },
        { attribute: "manoeuvrability", op: "ADD", value: 9 },
        { attribute: "detection", op: "ADD", value: 13 },
        { attribute: "armour", op: "ADD", value: 18 },
        { attribute: "turretRating", op: "ADD", value: 1 },
        { attribute: "crewRate", op: "ADD", value: 30 },
        { attribute: "piloting", op: "ADD", value: 0 },
        { attribute: "creed", op: "SET_CATEGORICAL", value: "Moderate" },
        {
          attribute: "weaponSlots",
          op: "PROVIDE",
          value: { prow: 1, dorsal: 1, port: 1, starboard: 1 },
        },
      ],
    },
    elements: [
      {
        id: "e1",
        type_: "MachineSpirit",
        name: "Haunted",
        enabled: true,
        bindings: [{ attribute: "morale", op: "ADD", value: -10, note: "unnerving hum" }],
      },
      {
        id: "e2",
        type_: "Component",
        name: "Reclaimed Plasma Battery",
        subtype: "Essential",
        description: "Salvaged from a derelict; coughs out raw power but drinks space.",
        enabled: true,
        bindings: [
          { attribute: "power", side: "total", op: "ADD", value: 45, note: "raw output" },
          { attribute: "space", side: "consumed", op: "ADD", value: 12 },
          { attribute: "shipPoints", side: "consumed", op: "ADD", value: 8 },
        ],
      },
      {
        id: "e3",
        type_: "Component",
        name: "Void Cathedral",
        subtype: "Supplemental",
        enabled: true,
        bindings: [
          { attribute: "morale", op: "ADD", value: 5, note: "Demonstrable Faith" },
          { attribute: "power", side: "consumed", op: "ADD", value: 1 },
          { attribute: "space", side: "consumed", op: "ADD", value: 3 },
          { attribute: "shipPoints", side: "consumed", op: "ADD", value: 2 },
          { attribute: "achievements", op: "GRANT", value: { label: "+150 Creed", note: "Shrine" } },
        ],
      },
      {
        id: "e4",
        type_: "PastHistory",
        name: "Stormcaller",
        enabled: true,
        bindings: [
          {
            attribute: "piloting",
            op: "ADD",
            value: 10,
            scope: "CONDITIONAL",
            condition: { environment: "hazardousCelestial" },
            note: "rides the warp storms",
          },
        ],
      },
      {
        id: "e5",
        type_: "Ability",
        name: "Lit the Void",
        enabled: true,
        bindings: [
          { attribute: "abilities", op: "GRANT", value: { label: "Lit the Void", note: "combat action" } },
        ],
      },
      {
        id: "e6",
        type_: "Component",
        name: "Sanctified Lance Battery",
        subtype: "Weapon",
        description: "Prow-mounted lance, sanctified by the Ecclesiarchy.",
        enabled: true,
        bindings: [
          { attribute: "weaponSlots", op: "OCCUPY", value: { prow: 1 } },
          { attribute: "power", side: "consumed", op: "ADD", value: 4 },
          { attribute: "space", side: "consumed", op: "ADD", value: 2 },
          { attribute: "shipPoints", side: "consumed", op: "ADD", value: 2 },
          {
            attribute: "weapons",
            op: "GRANT",
            value: {
              label: "Sanctified Lance Battery",
              note: "Str 5 · Dam 3 · 1d10+6 · Crit 2 · Range 1/2/4 · Special: Half range, Holy",
            },
          },
        ],
      },
    ],
    crewComposition: {
      groups: [
        { name: "Menial Labor Clades", sharePct: 50 },
        { name: "Imperialis Militarum", sharePct: 25 },
        { name: "Ecclesiarchy", sharePct: 10 },
        { name: "Technical & Maintenance", sharePct: 5 },
        { name: "Logistics & Bureaucracy", sharePct: 5 },
        { name: "Science / Security", sharePct: 5 },
      ],
      bindings: [{ attribute: "morale", op: "ADD", value: -3, note: "Class Division" }],
    },
  };
}

export function seedSheet(): ShipConfig {
  return structuredClone(makeSeed());
}

export function blankSheet(): ShipConfig {
  return {
    id: "ship_new",
    name: "Untitled Voidship",
    schemaVersion: 2,
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
