// src/sim/analog/api/simulateAnalog.js

import { buildNodes } from "../netlist/buildNodes";
import { toSpiceNetlist } from "../netlist/toSpiceNetlist";

/**
 * @typedef {Object} AnalogSimRequest
 * @property {Array} analogComponents
 * @property {Array} wires
 * @property {Object} [options]
 * @property {string} [options.title]
 * @property {string} [options.analysis]
 *   Why: later you’ll choose analysis type (tran/ac/dc). For now it’s just metadata.
 */

/**
 * @typedef {Object} AnalogSimResponse
 * @property {boolean} ok
 *   Why: UI can handle errors without throwing.
 * @property {string} netlist
 *   Why: show user/export/debug; later send to backend.
 * @property {Object} nodes
 * @property {Record<string,string>} nodes.pinToNode
 * @property {Array<{node:string,pinIds:string[]}>} nodes.nets
 * @property {Array<string>} warnings
 *   Why: floating nodes, missing values, etc (frontend validation).
 * @property {Array<string>} errors
 *   Why: blocking issues. For now we try to be permissive.
 * @property {Object|null} results
 *   Why: later backend will fill with waveforms/csv. For now null.
 */

/**
 * Frontend-only analog simulate “mock”.
 * It DOES NOT run ngspice.
 * It only prepares the netlist + node mapping.
 *
 * This should be safe to call often (e.g. on-demand when user clicks "Analog → Export Netlist").
 */
export async function simulateAnalog({ analogComponents = [], wires = [], options = {} }) {
  const warnings = [];
  const errors = [];

  // 1) Build node mapping (pinId -> node)
  const nodes = buildNodes({ analogComponents, wires });

  // 2) Basic validation (lightweight + non-breaking)
  //    Why: you want helpful messages early, without enforcing too much.
  for (const c of analogComponents || []) {
    if (!c) continue;

    // Missing ref/value warnings (netlist will still generate)
    if (!c.ref) warnings.push(`Component ${c.id} is missing ref (e.g., R1).`);
    if (c.kind !== "GND" && (c.value === undefined || c.value === null || c.value === "")) {
      warnings.push(`${c.ref || c.id} has empty value.`);
    }

    // Floating pins warning: pin not mapped -> means no wire connection (still ok)
    for (const p of c.pins || []) {
      if (!nodes.pinToNode[p.id]) {
        warnings.push(`${c.ref || c.id} pin "${p.name}" is not connected (floating).`);
      }
    }
  }

  // 3) Build SPICE netlist text
  let netlist = "";
  try {
    netlist = toSpiceNetlist({
      analogComponents,
      pinToNode: nodes.pinToNode,
      options: {
        title: options.title || "Analog Circuit",
      },
    });
  } catch (e) {
    errors.push(`Failed to build netlist: ${e?.message || String(e)}`);
  }

  return {
    ok: errors.length === 0,
    netlist,
    nodes,
    warnings,
    errors,
    results: null, // reserved for backend waveforms later
  };
}
