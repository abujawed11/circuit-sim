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

    if (c.kind === ANALOG_KIND.VAC) {
      const pPlus = pins[0]?.id;
      const pMinus = pins[1]?.id;
      const nPlus = pPlus ? nodeOf(pinToNode, pPlus) : `nc_${ref}_p`;
      const nMinus = pMinus ? nodeOf(pinToNode, pMinus) : SPICE_GROUND_NODE;

      // Auto-inject AC parameters if missing (for backward compatibility/UX)
      // If user has SIN(...) but no AC part, default to AC 1 0
      let finalValue = value;
      if (finalValue.toUpperCase().startsWith("SIN") && !finalValue.toUpperCase().includes("AC")) {
        finalValue += " AC 1 0";
      }

      lines.push(`${ref} ${nPlus} ${nMinus} ${finalValue}`);
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

    if (c.kind === ANALOG_KIND.D || c.kind === ANALOG_KIND.LED) {
      // Diode: D<ref> <anode> <cathode> <model>
      const pAnode = pins.find(p => p.name === "A")?.id || pins[0]?.id;
      const pCathode = pins.find(p => p.name === "K")?.id || pins[1]?.id;
      const nAnode = pAnode ? nodeOf(pinToNode, pAnode) : `nc_${ref}_a`;
      const nCathode = pCathode ? nodeOf(pinToNode, pCathode) : `nc_${ref}_k`;

      // Use value as model name (e.g., "D1N4148" or "D_LED")
      const modelName = value || (c.kind === ANALOG_KIND.LED ? "D_LED" : "D1N4148");
      lines.push(`${ref} ${nAnode} ${nCathode} ${modelName}`);
      emittedElements.push(ref);
      markUsedNodes(nAnode, nCathode);
      continue;
    }

    if (c.kind === ANALOG_KIND.NPN || c.kind === ANALOG_KIND.PNP) {
      // BJT: Q<ref> <collector> <base> <emitter> <model>
      const pCollector = pins.find(p => p.name === "C")?.id || pins[0]?.id;
      const pBase = pins.find(p => p.name === "B")?.id || pins[1]?.id;
      const pEmitter = pins.find(p => p.name === "E")?.id || pins[2]?.id;

      const nC = pCollector ? nodeOf(pinToNode, pCollector) : `nc_${ref}_c`;
      const nB = pBase ? nodeOf(pinToNode, pBase) : `nc_${ref}_b`;
      const nE = pEmitter ? nodeOf(pinToNode, pEmitter) : `nc_${ref}_e`;

      // Use value as model name (e.g., "2N2222" or "2N2907")
      const modelName = value || (c.kind === ANALOG_KIND.NPN ? "2N2222" : "2N2907");
      lines.push(`${ref} ${nC} ${nB} ${nE} ${modelName}`);
      emittedElements.push(ref);
      markUsedNodes(nC, nB, nE);
      continue;
    }

    if (c.kind === ANALOG_KIND.OPAMP) {
      // OpAmp subcircuit: X<ref> <in+> <in-> <out> <V+> <V-> <subckt-name>
      const pPlus = pins.find(p => p.name === "+")?.id || pins[0]?.id;
      const pMinus = pins.find(p => p.name === "-")?.id || pins[1]?.id;
      const pOut = pins.find(p => p.name === "OUT")?.id || pins[2]?.id;
      const pVPlus = pins.find(p => p.name === "V+")?.id || pins[3]?.id;
      const pVMinus = pins.find(p => p.name === "V-")?.id || pins[4]?.id;

      const nPlus = pPlus ? nodeOf(pinToNode, pPlus) : `nc_${ref}_p`;
      const nMinus = pMinus ? nodeOf(pinToNode, pMinus) : `nc_${ref}_m`;
      const nOut = pOut ? nodeOf(pinToNode, pOut) : `nc_${ref}_out`;
      const nVPlus = pVPlus ? nodeOf(pinToNode, pVPlus) : `nc_${ref}_vp`;
      const nVMinus = pVMinus ? nodeOf(pinToNode, pVMinus) : `nc_${ref}_vm`;

      // Use value as subcircuit name (e.g., "LM741")
      const subcktName = value || "LM741";
      lines.push(`${ref} ${nPlus} ${nMinus} ${nOut} ${nVPlus} ${nVMinus} ${subcktName}`);
      emittedElements.push(ref);
      markUsedNodes(nPlus, nMinus, nOut, nVPlus, nVMinus);
      continue;
    }

    if (c.kind === ANALOG_KIND.TRAFO) {
      // Transformer: L1, L2, and K (coupling)
      // Format: L<ref>_p <node1> <node2> <inductance>
      //         L<ref>_s <node3> <node4> <inductance>
      //         K<ref> L<ref>_p L<ref>_s <coupling>
      const pP1 = pins.find(p => p.name === "P1")?.id || pins[0]?.id;
      const pP2 = pins.find(p => p.name === "P2")?.id || pins[1]?.id;
      const pS1 = pins.find(p => p.name === "S1")?.id || pins[2]?.id;
      const pS2 = pins.find(p => p.name === "S2")?.id || pins[3]?.id;

      const nP1 = pP1 ? nodeOf(pinToNode, pP1) : `nc_${ref}_p1`;
      const nP2 = pP2 ? nodeOf(pinToNode, pP2) : `nc_${ref}_p2`;
      const nS1 = pS1 ? nodeOf(pinToNode, pS1) : `nc_${ref}_s1`;
      const nS2 = pS2 ? nodeOf(pinToNode, pS2) : `nc_${ref}_s2`;

      // Parse value: "L1 L2 coupling" (e.g., "1m 1m 0.99")
      const parts = (value || "1m 1m 0.99").split(/\s+/);
      const L1 = parts[0] || "1m";
      const L2 = parts[1] || "1m";
      const coupling = parts[2] || "0.99";

      const refBase = ref.replace(/^T/, "L"); // T1 -> L1
      const L1ref = `${refBase}p`;
      const L2ref = `${refBase}s`;
      const Kref = ref.replace(/^T/, "K");

      lines.push(`${L1ref} ${nP1} ${nP2} ${L1}`);
      lines.push(`${L2ref} ${nS1} ${nS2} ${L2}`);
      lines.push(`${Kref} ${L1ref} ${L2ref} ${coupling}`);

      emittedElements.push(L1ref, L2ref, Kref);
      markUsedNodes(nP1, nP2, nS1, nS2);
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
    // For OP analysis: use @device[i] syntax (only works for R, L, C, V sources)
    // Skip semiconductor devices (D, Q, X) as they don't support this syntax
    const currentSignals = emittedElements
      .filter(ref => {
        const firstChar = ref.charAt(0).toUpperCase();
        // Only R, L, C, V support @device[i] in ngspice
        return ['R', 'L', 'C', 'V'].includes(firstChar);
      })
      .map(ref => `@${ref.toLowerCase()}[i]`);

    const allSignals = [...voltageSignals, ...currentSignals].join(" ");

    lines.push("op");
    if (allSignals) {
      lines.push(`wrdata out_op.csv ${allSignals}`);
    }
  } else if (analysis.type === "tran") {
    const step = analysis.tran?.step || "1u";
    const stop = analysis.tran?.stop || "10m";

    // For TRAN analysis: use @device[i] (only works for R, L, C, V)
    // Skip semiconductor devices (D, Q, X) as they don't support this syntax
    const currentSignals = emittedElements
      .filter(ref => {
        const firstChar = ref.charAt(0).toUpperCase();
        // Only R, L, C, V support @device[i] in ngspice
        return ['R', 'L', 'C', 'V'].includes(firstChar);
      })
      .map(ref => `@${ref.toLowerCase()}[i]`);

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
  } else if (analysis.type === "ac") {
    // .ac dec/oct/lin <n> <fstart> <fstop>
    const variation = analysis.ac?.variation || "dec";
    const points = analysis.ac?.points || 10;
    const fstart = analysis.ac?.fstart || "1";
    const fstop = analysis.ac?.fstop || "10k";

    // AC analysis exports magnitude (dB) and phase.
    // Use db()/ph() forms since they work broadly across ngspice builds and avoid
    // relying on device internals like @R1[i] (which aren't available in AC).
    const nodesForAc = Array.from(usedNodes)
      .map((n) => String(n))
      .filter((n) => n && n !== SPICE_GROUND_NODE)
      .sort((a, b) => a.localeCompare(b));

    // Guard against magnitude=0 causing ngspice "argument out of range for db".
    // This can happen if the circuit has no AC excitation or a node is effectively 0V for the entire sweep.
    const acSignals = nodesForAc.flatMap((n) => [
      `db(mag(v(${n}))+1e-30)`,
      `ph(v(${n})+1e-30)`,
    ]);

    // If there are no signals (e.g. empty circuit), still write something so the backend
    // can show a useful result instead of "file not found".
    const allSignals = (acSignals.length > 0 ? acSignals : ["frequency"]).join(" ");

    lines.push("set wr_vecnames");
    lines.push("set wr_singlescale"); // frequency
    lines.push(`ac ${variation} ${points} ${fstart} ${fstop}`);
    lines.push(`wrdata out_ac.csv ${allSignals}`);
  }

  lines.push("quit");
  lines.push(".endc");

  // Add SPICE models for components (before .end)
  const modelsNeeded = new Set();

  for (const c of analogComponents) {
    if (!c || c.domain !== "analog") continue;

    if (c.kind === ANALOG_KIND.D) {
      const modelName = c.props?.value || "D1N4148";
      modelsNeeded.add(`D_${modelName}`);
    }
    if (c.kind === ANALOG_KIND.LED) {
      modelsNeeded.add("LED");
    }
    if (c.kind === ANALOG_KIND.NPN) {
      const modelName = c.props?.value || "2N2222";
      modelsNeeded.add(`NPN_${modelName}`);
    }
    if (c.kind === ANALOG_KIND.PNP) {
      const modelName = c.props?.value || "2N2907";
      modelsNeeded.add(`PNP_${modelName}`);
    }
    if (c.kind === ANALOG_KIND.OPAMP) {
      const subckt = c.props?.value || "LM741";
      modelsNeeded.add(`OPAMP_${subckt}`);
    }
  }

  // Emit model definitions
  if (modelsNeeded.has("D_D1N4148")) {
    lines.push("* Diode model: 1N4148");
    lines.push(".model D1N4148 D (IS=5.84n N=1.94 RS=0.7 BV=100 IBV=100u)");
  }

  if (modelsNeeded.has("LED")) {
    lines.push("* LED model");
    lines.push(".model D_LED D (IS=1e-15 N=1.8 RS=1 BV=5 IBV=10u)");
  }

  if (modelsNeeded.has("NPN_2N2222")) {
    lines.push("* NPN BJT model: 2N2222");
    lines.push(".model 2N2222 NPN (IS=14.34f XTI=3 EG=1.11 VAF=74.03 BF=255.9 NE=1.307 ISE=14.34f IKF=.2847 XTB=1.5 BR=6.092 NC=2 ISC=0 IKR=0 RC=1 CJC=7.306p MJC=.3416 VJC=.75 FC=.5 CJE=22.01p MJE=.377 VJE=.75 TR=46.91n TF=411.1p ITF=.6 VTF=1.7 XTF=3 RB=10)");
  }

  if (modelsNeeded.has("PNP_2N2907")) {
    lines.push("* PNP BJT model: 2N2907");
    lines.push(".model 2N2907 PNP (IS=1.0f BF=200 NF=1.2 VAF=50 IKF=0.3 ISE=1.0f NE=1.5 BR=3 NR=1.0 VAR=6.4 IKR=0.4 ISC=1.0f NC=1.5 RB=10 RC=0.4 RE=0.2 CJE=20p CJC=10p TF=0.6n TR=50n)");
  }

  if (modelsNeeded.has("OPAMP_LM741")) {
    lines.push("* OpAmp subcircuit: LM741");
    lines.push(".subckt LM741 inp inn out vp vm");
    lines.push("* Simple opamp model with gain and output limits");
    lines.push("Rin inp inn 1Meg");
    lines.push("Egain 1 0 inp inn 100k");
    lines.push("Rout 1 out 75");
    lines.push("Cout out 0 10p");
    lines.push(".ends");
  }

  lines.push(".end");
  return lines.join("\n");
}
