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

  const emittedElements = [];
  const usedNodes = new Set();

  const markUsedNodes = (...nodes) => {
    for (const n of nodes) {
      if (n === undefined || n === null) continue;
      usedNodes.add(String(n));
    }
  };

  // Optional: emit sources first (cleaner). SPICE doesn't require this, but it helps readability.
  const ordered = [
    ...analogComponents.filter(
      (c) =>
        c?.domain === "analog" &&
        (c.kind === ANALOG_KIND.VDC || c.kind === ANALOG_KIND.AMMETER)
    ),
    ...analogComponents.filter(
      (c) =>
        c?.domain === "analog" &&
        c.kind !== ANALOG_KIND.VDC &&
        c.kind !== ANALOG_KIND.AMMETER
    ),
  ];

  for (const c of ordered) {
    if (!c || c.domain !== "analog") continue;
    if (c.kind === ANALOG_KIND.GND) continue;
    // Voltmeter is a non-loading measurement device: do not emit it into the SPICE netlist.
    if (c.kind === ANALOG_KIND.VOLTMETER) continue;

    const pins = c.pins || [];
    const ref = uniqueRef(c.ref || c.id);
    const value = c.props?.value ?? "";

    if (c.kind === ANALOG_KIND.R || c.kind === ANALOG_KIND.C || c.kind === ANALOG_KIND.L) {
      const p1 = pins[0]?.id;
      const p2 = pins[1]?.id;
      const n1 = p1 ? nodeOf(pinToNode, p1) : `nc_${ref}_1`;
      const n2 = p2 ? nodeOf(pinToNode, p2) : `nc_${ref}_2`;
      lines.push(`${ref} ${n1} ${n2} ${value}`);
      emittedElements.push(ref);
      markUsedNodes(n1, n2);
      continue;
    }

    if (c.kind === ANALOG_KIND.VDC) {
      const pPlus = pins[0]?.id;
      const pMinus = pins[1]?.id;
      const nPlus = pPlus ? nodeOf(pinToNode, pPlus) : `nc_${ref}_p`;
      const nMinus = pMinus ? nodeOf(pinToNode, pMinus) : SPICE_GROUND_NODE;
      lines.push(`${ref} ${nPlus} ${nMinus} DC ${value}`);
      emittedElements.push(ref);
      markUsedNodes(nPlus, nMinus);
      continue;
    }

    if (c.kind === ANALOG_KIND.AMMETER) {
      // Emit an ideal 0V voltage source so ngspice can report branch current through it.
      const p1 = pins[0]?.id;
      const p2 = pins[1]?.id;
      const n1 = p1 ? nodeOf(pinToNode, p1) : `nc_${ref}_1`;
      const n2 = p2 ? nodeOf(pinToNode, p2) : `nc_${ref}_2`;
      lines.push(`${ref} ${n1} ${n2} DC 0`);
      emittedElements.push(ref);
      markUsedNodes(n1, n2);
      continue;
    }
  }

  // --- Signals to Record ---
  // 1. Voltages: only nodes that actually appear in emitted element lines (excluding 0)
  const voltageSignals = Array.from(usedNodes)
    .filter((n) => n && n !== SPICE_GROUND_NODE)
    .map((n) => `v(${n})`);

  // --- Analysis Commands ---
  const analysis = options.analysis || { type: "op" };

  lines.push(".control");

  if (analysis.type === "op") {
    // For OP analysis: use @device[i] syntax (works fine for DC)
    const currentSignals = emittedElements.map(ref => `@${ref.toLowerCase()}[i]`);
    const allSignals = [...voltageSignals, ...currentSignals].join(" ");

    lines.push("op");
    if (allSignals) {
      lines.push(`wrdata out_op.csv ${allSignals}`);
    }
  } else if (analysis.type === "tran") {
    const step = analysis.tran?.step || "1u";
    const stop = analysis.tran?.stop || "10m";

    // For TRAN analysis: use @device[i] too, but ensure it's saved as a vector (see savecurrents/save below).
    const currentSignals = emittedElements.map(ref => `@${ref.toLowerCase()}[i]`);
    const allSignals = [...voltageSignals, ...currentSignals].join(" ");

    // Use "uic" to skip DC op point for transient
    // Also force a stable, parseable wrdata format across ngspice builds:
    // - `wr_vecnames`: include a header row with vector names
    // - `wr_singlescale`: include "time" once as the first column
    lines.push("set wr_vecnames");
    lines.push("set wr_singlescale");
    // Ensure device currents are saved as time-varying vectors.
    // Without this, ngspice may write the final-point scalar repeated on every row for @ref[i].
    lines.push("set savecurrents");
    if (allSignals) {
      lines.push(`save ${allSignals}`);
    }
    lines.push(`tran ${step} ${stop} uic`);
    if (allSignals) {
      lines.push(`wrdata out.csv ${allSignals}`);
    }
  }

  lines.push("quit");
  lines.push(".endc");

  lines.push(".end");
  return lines.join("\n");
}
