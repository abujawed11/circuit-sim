// // src/sim/analog/model/analogParts.js

// import { ANALOG_DOMAIN, ANALOG_KIND, ANALOG_PART_DEFS, SPICE_GROUND_NODE } from "./analogTypes";

// const uid = () => {
//   if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
//   return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
// };

// const refCounters = new Map();
// const nextRef = (prefix) => {
//   const n = (refCounters.get(prefix) ?? 0) + 1;
//   refCounters.set(prefix, n);
//   return `${prefix}${n}`;
// };

// const makePin = (name, offset) => ({
//   id: uid(),
//   name,       // "1","2","+","-","0"
//   offset,     // for drawing terminal position relative to component
// });

// /**
//  * Minimal consistent analog component shape.
//  * No digital state, no direction, only netlist-relevant fields.
//  */
// export const makeAnalogComponent = (kind, x = 120, y = 120) => {
//   const def = ANALOG_PART_DEFS[kind];
//   if (!def) throw new Error(`Unknown analog kind: ${kind}`);

//   const ref = kind === ANALOG_KIND.GND ? "GND" : nextRef(def.refPrefix);
//   const { w, h } = def.size;

//   // Pin offsets are just UI helpers for your Canvas.
//   const pins = (() => {
//     if (kind === ANALOG_KIND.VDC) {
//       return [
//         makePin("+", { x: 0, y: -h / 2 }),
//         makePin("-", { x: 0, y:  h / 2 }),
//       ];
//     }
//     if (kind === ANALOG_KIND.GND) {
//       return [makePin(SPICE_GROUND_NODE, { x: 0, y: 0 })];
//     }
//     // 2-pin parts
//     return [
//       makePin("1", { x: -w / 2, y: 0 }),
//       makePin("2", { x:  w / 2, y: 0 }),
//     ];
//   })();

//   return {
//     id: uid(),
//     domain: ANALOG_DOMAIN,
//     kind,
//     ref,                 // R1, C1, L1, V1, (GND label)
//     x, y, w, h,
//     rotate: 0,
//     pins,
//     props: {
//       value: def.defaultValue, // "1k", "1u", "5"
//     },
//   };
// };






// src/sim/analog/model/analogParts.js

import {
  ANALOG_DOMAIN,
  ANALOG_KIND,
  ANALOG_PART_DEFS,
  SPICE_GROUND_NODE,
} from "./analogTypes";

const uid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
};

// --- Refdes counters (Option A) ---
const refCounters = new Map(); // prefix -> maxNumberUsed
let countersSeeded = false;

/**
 * Parse refs like R12, C3, V1 -> {prefix:"R", num:12}
 */
function parseRef(ref) {
  if (typeof ref !== "string") return null;
  const m = ref.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  return { prefix: m[1].toUpperCase(), num: parseInt(m[2], 10) };
}

/**
 * Seed counters from existing components in the circuit.
 * WHY: if you load/import a circuit that already has R1/R2,
 * starting counters at 0 would generate duplicates.
 */
export function seedAnalogRefCounters(existingComponents = []) {
  for (const c of existingComponents || []) {
    if (!c) continue;
    if (c.domain !== ANALOG_DOMAIN) continue;
    if (!c.ref) continue;

    const parsed = parseRef(c.ref);
    if (!parsed) continue;

    const cur = refCounters.get(parsed.prefix) ?? 0;
    if (parsed.num > cur) refCounters.set(parsed.prefix, parsed.num);
  }
  countersSeeded = true;
}

/**
 * Generate next unique ref for a given prefix (R/C/L/V).
 */
const nextRef = (prefix) => {
  const p = String(prefix || "X").toUpperCase();
  const n = (refCounters.get(p) ?? 0) + 1;
  refCounters.set(p, n);
  return `${p}${n}`;
};

const makePin = (name, offset) => ({
  id: uid(),
  name,   // "1","2","+","-","0"
  offset, // for drawing terminal position relative to component
});

/**
 * Minimal consistent analog component shape.
 * No digital state, no direction, only netlist-relevant fields.
 *
 * NEW: optionally pass `existingComponents` so refs are seeded once.
 * This is backward compatible: old calls still work.
 */
export const makeAnalogComponent = (kind, x = 120, y = 120, existingComponents = null) => {
  const def = ANALOG_PART_DEFS[kind];
  if (!def) throw new Error(`Unknown analog kind: ${kind}`);

  // Seed counters once from existing circuit (recommended).
  if (!countersSeeded && Array.isArray(existingComponents)) {
    seedAnalogRefCounters(existingComponents);
  }

  const ref = kind === ANALOG_KIND.GND ? "GND" : nextRef(def.refPrefix);
  const { w, h } = def.size;

  const pins = (() => {
    if (kind === ANALOG_KIND.VDC) {
      return [
        makePin("+", { x: 0, y: -h / 2 }),
        makePin("-", { x: 0, y: h / 2 }),
      ];
    }
    if (kind === ANALOG_KIND.GND) {
      return [makePin(SPICE_GROUND_NODE, { x: 0, y: 0 })];
    }
    // 2-pin parts
    return [
      makePin("1", { x: -w / 2, y: 0 }),
      makePin("2", { x: w / 2, y: 0 }),
    ];
  })();

  return {
    id: uid(),
    domain: ANALOG_DOMAIN,
    kind,
    ref, // R1, C1, L1, V1, (GND label)
    x,
    y,
    w,
    h,
    rotate: 0,
    pins,
    props: {
      value: def.defaultValue, // "1k", "1u", "5"
    },
  };
};
