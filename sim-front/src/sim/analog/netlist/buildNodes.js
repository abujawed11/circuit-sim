// src/sim/analog/netlist/buildNodes.js

import { ANALOG_KIND, SPICE_GROUND_NODE } from "../model/analogTypes";

/**
 * Union-Find / Disjoint Set
 * Why: wires form connectivity groups. Union-Find is the cleanest way to
 * group connected pinIds into nets.
 */
class DSU {
  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  make(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x) {
    this.make(x);
    const p = this.parent.get(x);
    if (p !== x) this.parent.set(x, this.find(p));
    return this.parent.get(x);
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;

    const rka = this.rank.get(ra) || 0;
    const rkb = this.rank.get(rb) || 0;

    if (rka < rkb) this.parent.set(ra, rb);
    else if (rka > rkb) this.parent.set(rb, ra);
    else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rka + 1);
    }
  }
}

/**
 * Normalize different possible wire endpoint shapes into [pinIdA, pinIdB].
 *
 * Why: your existing editor might store wire endpoints in different structures.
 * We support a few common shapes WITHOUT modifying your digital wire model.
 */
function getWirePinIds(wire) {
  // Common shapes we’ll try (safe, non-throwy):
  // 1) { fromPinId, toPinId }
  if (wire?.fromPinId && wire?.toPinId) return [wire.fromPinId, wire.toPinId];

  // 2) { aPinId, bPinId }
  if (wire?.aPinId && wire?.bPinId) return [wire.aPinId, wire.bPinId];

  // 3) { a: { pinId }, b: { pinId } }
  if (wire?.a?.pinId && wire?.b?.pinId) return [wire.a.pinId, wire.b.pinId];

  // 4) { endpoints: [{ pinId }, { pinId }] }
  if (Array.isArray(wire?.endpoints) && wire.endpoints.length >= 2) {
    const p0 = wire.endpoints[0]?.pinId;
    const p1 = wire.endpoints[1]?.pinId;
    if (p0 && p1) return [p0, p1];
  }

  return [null, null];
}

/**
 * Build a set of analog pinIds for filtering.
 *
 * Why: wires are shared with digital. We must ONLY consider wires that touch
 * analog pins (domain separation).
 */
function collectAnalogPinIds(analogComponents) {
  const analogPinIds = new Set();
  const gndPinIds = new Set();

  for (const c of analogComponents || []) {
    for (const p of c?.pins || []) {
      analogPinIds.add(p.id);
      if (c.kind === ANALOG_KIND.GND) gndPinIds.add(p.id);
    }
  }

  return { analogPinIds, gndPinIds };
}

/**
 * Main function
 *
 * @param {Object} params
 * @param {Array} params.analogComponents - your analog comps list (domain="analog")
 * @param {Array} params.wires - shared wires list from editor (digital+analog mixed)
 *
 * @returns {{
 *   pinToNode: Record<string,string>,
 *   nets: Array<{ node: string, pinIds: string[] }>,
 * }}
 *
 * WHY these outputs:
 * - pinToNode: netlist exporter needs fast lookup for each pin.
 * - nets: useful for debugging UI ("this net is n2, includes these pins").
 */
export function buildNodes({ analogComponents = [], wires = [] }) {
  const { analogPinIds, gndPinIds } = collectAnalogPinIds(analogComponents);

  const dsu = new DSU();

  // Ensure all analog pins exist in DSU, even if floating (unconnected).
  for (const pinId of analogPinIds) dsu.make(pinId);

  // Union only wires that connect two ANALOG pins.
  for (const w of wires || []) {
    const [a, b] = getWirePinIds(w);
    if (!a || !b) continue;

    // Only union if both endpoints belong to analog pins
    if (analogPinIds.has(a) && analogPinIds.has(b)) {
      dsu.union(a, b);
    }
  }

  // Group pins by DSU root (net)
  const rootToPins = new Map();
  for (const pinId of analogPinIds) {
    const root = dsu.find(pinId);
    if (!rootToPins.has(root)) rootToPins.set(root, []);
    rootToPins.get(root).push(pinId);
  }

  // Decide which nets are ground (node "0")
  const groundRoots = new Set();
  for (const gndPinId of gndPinIds) {
    groundRoots.add(dsu.find(gndPinId));
  }

  // Assign node names
  let counter = 1;
  const rootToNode = new Map();

  for (const [root] of rootToPins) {
    if (groundRoots.has(root)) {
      rootToNode.set(root, SPICE_GROUND_NODE);
    } else {
      rootToNode.set(root, `n${counter++}`);
    }
  }

  // Build pinToNode mapping
  const pinToNode = {};
  for (const [root, pins] of rootToPins) {
    const node = rootToNode.get(root);
    for (const pid of pins) pinToNode[pid] = node;
  }

  // Build nets list (debug-friendly)
  const nets = [];
  for (const [root, pins] of rootToPins) {
    nets.push({ node: rootToNode.get(root), pinIds: pins.slice() });
  }

  return { pinToNode, nets };
}
