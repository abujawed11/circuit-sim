// src/sim/analog/netlist/toSpiceNetlist.js

import { ANALOG_KIND, SPICE_GROUND_NODE } from "../model/analogTypes";

/**
 * Helper: get node for a pinId, defaulting to a unique floating node
 * (but we keep it simple: if missing, use "nc" + pinId suffix).
 *
 * Why: floating pins can exist while user is drawing.
 * Netlist should still generate (even if ngspice later complains).
 */
function nodeOf(pinToNode, pinId) {
  return pinToNode?.[pinId] || `nc_${String(pinId).slice(-6)}`;
}

/**
 * Export a minimal SPICE netlist.
 *
 * @param {Object} params
 * @param {Array} params.analogComponents
 * @param {Record<string,string>} params.pinToNode
 * @param {Object} params.options
 * @param {string} params.options.title
 *
 * @returns {string}
 */
export function toSpiceNetlist({
  analogComponents = [],
  pinToNode = {},
  options = {},
}) {
  const title = options.title || "Analog Circuit";

  const lines = [];
  lines.push(`* ${title}`);

  for (const c of analogComponents) {
    if (!c || c.domain !== "analog") continue;

    // Skip GND device line. Ground is handled by node mapping to "0".
    if (c.kind === ANALOG_KIND.GND) continue;

    const pins = c.pins || [];
    const ref = c.ref || c.id;
    const value = c.props?.value ?? "";

    // 2-pin passives
    if (c.kind === ANALOG_KIND.R || c.kind === ANALOG_KIND.C || c.kind === ANALOG_KIND.L) {
      const p1 = pins[0]?.id;
      const p2 = pins[1]?.id;
      const n1 = p1 ? nodeOf(pinToNode, p1) : `nc_${ref}_1`;
      const n2 = p2 ? nodeOf(pinToNode, p2) : `nc_${ref}_2`;
      lines.push(`${ref} ${n1} ${n2} ${value}`);
      continue;
    }

    // VDC: pins[0] = +, pins[1] = -
    if (c.kind === ANALOG_KIND.VDC) {
      const pPlus = pins[0]?.id;
      const pMinus = pins[1]?.id;
      const nPlus = pPlus ? nodeOf(pinToNode, pPlus) : `nc_${ref}_p`;
      const nMinus = pMinus ? nodeOf(pinToNode, pMinus) : SPICE_GROUND_NODE;
      lines.push(`${ref} ${nPlus} ${nMinus} DC ${value}`);
      continue;
    }

    // Unknown kinds: ignore for now (future parts will be added explicitly)
  }

  // Minimal ending
  lines.push(".end");
  return lines.join("\n");
}
