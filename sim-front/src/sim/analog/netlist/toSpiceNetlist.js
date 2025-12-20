// // src/sim/analog/netlist/toSpiceNetlist.js

// import { ANALOG_KIND, SPICE_GROUND_NODE } from "../model/analogTypes";

// /**
//  * Helper: get node for a pinId, defaulting to a unique floating node
//  * (but we keep it simple: if missing, use "nc" + pinId suffix).
//  *
//  * Why: floating pins can exist while user is drawing.
//  * Netlist should still generate (even if ngspice later complains).
//  */
// function nodeOf(pinToNode, pinId) {
//   return pinToNode?.[pinId] || `nc_${String(pinId).slice(-6)}`;
// }

// /**
//  * Export a minimal SPICE netlist.
//  *
//  * @param {Object} params
//  * @param {Array} params.analogComponents
//  * @param {Record<string,string>} params.pinToNode
//  * @param {Object} params.options
//  * @param {string} params.options.title
//  *
//  * @returns {string}
//  */
// export function toSpiceNetlist({
//   analogComponents = [],
//   pinToNode = {},
//   options = {},
// }) {
//   const title = options.title || "Analog Circuit";

//   const lines = [];
//   lines.push(`* ${title}`);

//   for (const c of analogComponents) {
//     if (!c || c.domain !== "analog") continue;

//     // Skip GND device line. Ground is handled by node mapping to "0".
//     if (c.kind === ANALOG_KIND.GND) continue;

//     const pins = c.pins || [];
//     const ref = c.ref || c.id;
//     const value = c.props?.value ?? "";

//     // 2-pin passives
//     if (c.kind === ANALOG_KIND.R || c.kind === ANALOG_KIND.C || c.kind === ANALOG_KIND.L) {
//       const p1 = pins[0]?.id;
//       const p2 = pins[1]?.id;
//       const n1 = p1 ? nodeOf(pinToNode, p1) : `nc_${ref}_1`;
//       const n2 = p2 ? nodeOf(pinToNode, p2) : `nc_${ref}_2`;
//       lines.push(`${ref} ${n1} ${n2} ${value}`);
//       continue;
//     }

//     // VDC: pins[0] = +, pins[1] = -
//     if (c.kind === ANALOG_KIND.VDC) {
//       const pPlus = pins[0]?.id;
//       const pMinus = pins[1]?.id;
//       const nPlus = pPlus ? nodeOf(pinToNode, pPlus) : `nc_${ref}_p`;
//       const nMinus = pMinus ? nodeOf(pinToNode, pMinus) : SPICE_GROUND_NODE;
//       lines.push(`${ref} ${nPlus} ${nMinus} DC ${value}`);
//       continue;
//     }

//     // Unknown kinds: ignore for now (future parts will be added explicitly)
//   }

//   // Minimal ending
//   lines.push(".end");
//   return lines.join("\n");
// }





// src/sim/analog/netlist/toSpiceNetlist.js

import { ANALOG_KIND, SPICE_GROUND_NODE } from "../model/analogTypes";

function nodeOf(pinToNode, pinId) {
  return pinToNode?.[pinId] || `nc_${String(pinId).slice(-6)}`;
}

function parseRef(ref) {
  if (typeof ref !== "string") return null;
  const m = ref.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  return { prefix: m[1].toUpperCase(), num: parseInt(m[2], 10) };
}

/**
 * Create a unique ref generator for this export.
 * WHY: SPICE requires every element name to be unique (R1, R2...).
 * Even if UI accidentally has duplicates, export must stay valid.
 */
function makeUniqueRefFn(existingRefs) {
  const used = new Set();
  const maxByPrefix = new Map();

  // Prime maxByPrefix from existing refs to know the max number used
  // WHY: If circuit has R1, R2, R5, we track max=5 so new refs start at R6
  // NOTE: We DON'T add to 'used' during priming, because we want to reuse
  //       the same refs when generating the netlist (R1 stays R1, not R3)
  for (const r of existingRefs) {
    if (!r) continue;
    // DON'T add to used here - only track the max counter per prefix

    const pr = parseRef(r);
    if (pr) {
      const cur = maxByPrefix.get(pr.prefix) ?? 0;
      if (pr.num > cur) maxByPrefix.set(pr.prefix, pr.num);
    }
  }

  return (baseRef) => {
    const ref0 = String(baseRef || "").trim() || "X1";

    // If this ref hasn't been used yet in THIS netlist generation, use it as-is
    if (!used.has(ref0)) {
      used.add(ref0);
      const pr = parseRef(ref0);
      if (pr) {
        const cur = maxByPrefix.get(pr.prefix) ?? 0;
        if (pr.num > cur) maxByPrefix.set(pr.prefix, pr.num);
      }
      return ref0;
    }

    // If it's like R1/C2/V3, generate next number for that prefix
    const pr = parseRef(ref0);
    if (pr) {
      const next = (maxByPrefix.get(pr.prefix) ?? 0) + 1;
      maxByPrefix.set(pr.prefix, next);
      const r = `${pr.prefix}${next}`;
      used.add(r);
      return r;
    }

    // Fallback: append _2, _3...
    let i = 2;
    while (used.has(`${ref0}_${i}`)) i++;
    const r = `${ref0}_${i}`;
    used.add(r);
    return r;
  };
}

export function toSpiceNetlist({
  analogComponents = [],
  pinToNode = {},
  options = {},
}) {
  const title = options.title || "Analog Circuit";
  const lines = [];
  lines.push(`* ${title}`);

  // Collect refs that already exist in the circuit (excluding GND)
  const refsInCircuit = [];
  for (const c of analogComponents) {
    if (!c || c.domain !== "analog") continue;
    if (c.kind === ANALOG_KIND.GND) continue;
    refsInCircuit.push(c.ref || c.id);
  }

  const uniqueRef = makeUniqueRefFn(refsInCircuit);

  // Optional: emit sources first (cleaner). SPICE doesn't require this, but it helps readability.
  const ordered = [
    ...analogComponents.filter((c) => c?.domain === "analog" && c.kind === ANALOG_KIND.VDC),
    ...analogComponents.filter((c) => c?.domain === "analog" && c.kind !== ANALOG_KIND.VDC),
  ];

  for (const c of ordered) {
    if (!c || c.domain !== "analog") continue;
    if (c.kind === ANALOG_KIND.GND) continue;

    const pins = c.pins || [];
    const ref = uniqueRef(c.ref || c.id);
    const value = c.props?.value ?? "";

    if (c.kind === ANALOG_KIND.R || c.kind === ANALOG_KIND.C || c.kind === ANALOG_KIND.L) {
      const p1 = pins[0]?.id;
      const p2 = pins[1]?.id;
      const n1 = p1 ? nodeOf(pinToNode, p1) : `nc_${ref}_1`;
      const n2 = p2 ? nodeOf(pinToNode, p2) : `nc_${ref}_2`;
      lines.push(`${ref} ${n1} ${n2} ${value}`);
      continue;
    }

    if (c.kind === ANALOG_KIND.VDC) {
      const pPlus = pins[0]?.id;
      const pMinus = pins[1]?.id;
      const nPlus = pPlus ? nodeOf(pinToNode, pPlus) : `nc_${ref}_p`;
      const nMinus = pMinus ? nodeOf(pinToNode, pMinus) : SPICE_GROUND_NODE;
      lines.push(`${ref} ${nPlus} ${nMinus} DC ${value}`);
      continue;
    }
  }

  lines.push(".end");
  return lines.join("\n");
}
