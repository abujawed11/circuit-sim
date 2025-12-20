// src/sim/analog/model/analogParts.js

import { ANALOG_DOMAIN, ANALOG_KIND, ANALOG_PART_DEFS, SPICE_GROUND_NODE } from "./analogTypes";

const uid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
};

const refCounters = new Map();
const nextRef = (prefix) => {
  const n = (refCounters.get(prefix) ?? 0) + 1;
  refCounters.set(prefix, n);
  return `${prefix}${n}`;
};

const makePin = (name, offset) => ({
  id: uid(),
  name,       // "1","2","+","-","0"
  offset,     // for drawing terminal position relative to component
});

/**
 * Minimal consistent analog component shape.
 * No digital state, no direction, only netlist-relevant fields.
 */
export const makeAnalogComponent = (kind, x = 120, y = 120) => {
  const def = ANALOG_PART_DEFS[kind];
  if (!def) throw new Error(`Unknown analog kind: ${kind}`);

  const ref = kind === ANALOG_KIND.GND ? "GND" : nextRef(def.refPrefix);
  const { w, h } = def.size;

  // Pin offsets are just UI helpers for your Canvas.
  const pins = (() => {
    if (kind === ANALOG_KIND.VDC) {
      return [
        makePin("+", { x: 0, y: -h / 2 }),
        makePin("-", { x: 0, y:  h / 2 }),
      ];
    }
    if (kind === ANALOG_KIND.GND) {
      return [makePin(SPICE_GROUND_NODE, { x: 0, y: 0 })];
    }
    // 2-pin parts
    return [
      makePin("1", { x: -w / 2, y: 0 }),
      makePin("2", { x:  w / 2, y: 0 }),
    ];
  })();

  return {
    id: uid(),
    domain: ANALOG_DOMAIN,
    kind,
    ref,                 // R1, C1, L1, V1, (GND label)
    x, y, w, h,
    rotate: 0,
    pins,
    props: {
      value: def.defaultValue, // "1k", "1u", "5"
    },
  };
};
