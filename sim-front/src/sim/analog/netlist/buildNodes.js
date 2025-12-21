// // src/sim/analog/netlist/buildNodes.js

// import { ANALOG_KIND, SPICE_GROUND_NODE } from "../model/analogTypes";

// /**
//  * Union-Find / Disjoint Set
//  * Why: wires form connectivity groups. Union-Find is the cleanest way to
//  * group connected pinIds into nets.
//  */
// class DSU {
//   constructor() {
//     this.parent = new Map();
//     this.rank = new Map();
//   }

//   make(x) {
//     if (!this.parent.has(x)) {
//       this.parent.set(x, x);
//       this.rank.set(x, 0);
//     }
//   }

//   find(x) {
//     this.make(x);
//     const p = this.parent.get(x);
//     if (p !== x) this.parent.set(x, this.find(p));
//     return this.parent.get(x);
//   }

//   union(a, b) {
//     const ra = this.find(a);
//     const rb = this.find(b);
//     if (ra === rb) return;

//     const rka = this.rank.get(ra) || 0;
//     const rkb = this.rank.get(rb) || 0;

//     if (rka < rkb) this.parent.set(ra, rb);
//     else if (rka > rkb) this.parent.set(rb, ra);
//     else {
//       this.parent.set(rb, ra);
//       this.rank.set(ra, rka + 1);
//     }
//   }
// }

// /**
//  * Normalize different possible wire endpoint shapes into [pinIdA, pinIdB].
//  *
//  * Why: your existing editor might store wire endpoints in different structures.
//  * We support a few common shapes WITHOUT modifying your digital wire model.
//  */
// function getWirePinIds(wire) {
//   // Common shapes we’ll try (safe, non-throwy):
//   // 1) { fromPinId, toPinId }
//   if (wire?.fromPinId && wire?.toPinId) return [wire.fromPinId, wire.toPinId];

//   // 2) { aPinId, bPinId }
//   if (wire?.aPinId && wire?.bPinId) return [wire.aPinId, wire.bPinId];

//   // 3) { a: { pinId }, b: { pinId } }
//   if (wire?.a?.pinId && wire?.b?.pinId) return [wire.a.pinId, wire.b.pinId];

//   // 4) { endpoints: [{ pinId }, { pinId }] }
//   if (Array.isArray(wire?.endpoints) && wire.endpoints.length >= 2) {
//     const p0 = wire.endpoints[0]?.pinId;
//     const p1 = wire.endpoints[1]?.pinId;
//     if (p0 && p1) return [p0, p1];
//   }

//   return [null, null];
// }

// /**
//  * Build a set of analog pinIds for filtering.
//  *
//  * Why: wires are shared with digital. We must ONLY consider wires that touch
//  * analog pins (domain separation).
//  */
// function collectAnalogPinIds(analogComponents) {
//   const analogPinIds = new Set();
//   const gndPinIds = new Set();

//   for (const c of analogComponents || []) {
//     for (const p of c?.pins || []) {
//       analogPinIds.add(p.id);
//       if (c.kind === ANALOG_KIND.GND) gndPinIds.add(p.id);
//     }
//   }

//   return { analogPinIds, gndPinIds };
// }

// /**
//  * Main function
//  *
//  * @param {Object} params
//  * @param {Array} params.analogComponents - your analog comps list (domain="analog")
//  * @param {Array} params.wires - shared wires list from editor (digital+analog mixed)
//  *
//  * @returns {{
//  *   pinToNode: Record<string,string>,
//  *   nets: Array<{ node: string, pinIds: string[] }>,
//  * }}
//  *
//  * WHY these outputs:
//  * - pinToNode: netlist exporter needs fast lookup for each pin.
//  * - nets: useful for debugging UI ("this net is n2, includes these pins").
//  */
// export function buildNodes({ analogComponents = [], wires = [] }) {
//   const { analogPinIds, gndPinIds } = collectAnalogPinIds(analogComponents);

//   const dsu = new DSU();

//   // Ensure all analog pins exist in DSU, even if floating (unconnected).
//   for (const pinId of analogPinIds) dsu.make(pinId);

//   // Union only wires that connect two ANALOG pins.
//   for (const w of wires || []) {
//     const [a, b] = getWirePinIds(w);
//     if (!a || !b) continue;

//     // Only union if both endpoints belong to analog pins
//     if (analogPinIds.has(a) && analogPinIds.has(b)) {
//       dsu.union(a, b);
//     }
//   }

//   // Group pins by DSU root (net)
//   const rootToPins = new Map();
//   for (const pinId of analogPinIds) {
//     const root = dsu.find(pinId);
//     if (!rootToPins.has(root)) rootToPins.set(root, []);
//     rootToPins.get(root).push(pinId);
//   }

//   // Decide which nets are ground (node "0")
//   const groundRoots = new Set();
//   for (const gndPinId of gndPinIds) {
//     groundRoots.add(dsu.find(gndPinId));
//   }

//   // Assign node names
//   let counter = 1;
//   const rootToNode = new Map();

//   for (const [root] of rootToPins) {
//     if (groundRoots.has(root)) {
//       rootToNode.set(root, SPICE_GROUND_NODE);
//     } else {
//       rootToNode.set(root, `n${counter++}`);
//     }
//   }

//   // Build pinToNode mapping
//   const pinToNode = {};
//   for (const [root, pins] of rootToPins) {
//     const node = rootToNode.get(root);
//     for (const pid of pins) pinToNode[pid] = node;
//   }

//   // Build nets list (debug-friendly)
//   const nets = [];
//   for (const [root, pins] of rootToPins) {
//     nets.push({ node: rootToNode.get(root), pinIds: pins.slice() });
//   }

//   return { pinToNode, nets };
// }





// src/sim/analog/netlist/buildNodes.js
import { ANALOG_KIND, SPICE_GROUND_NODE } from "../model/analogTypes";

// --- DSU ---
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

// --- wire endpoint normalizer ---
function getWirePinIds(wire) {
  if (wire?.fromPinId && wire?.toPinId) return [wire.fromPinId, wire.toPinId];
  if (wire?.aPinId && wire?.bPinId) return [wire.aPinId, wire.bPinId];
  if (wire?.a?.pinId && wire?.b?.pinId) return [wire.a.pinId, wire.b.pinId];
  if (Array.isArray(wire?.endpoints) && wire.endpoints.length >= 2) {
    const p0 = wire.endpoints[0]?.pinId;
    const p1 = wire.endpoints[1]?.pinId;
    if (p0 && p1) return [p0, p1];
  }
  return [null, null];
}

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
 * Build nodes for analog pins, but include any "junction pins" that are connected
 * to the analog network through wires.
 */
export function buildNodes({ analogComponents = [], wires = [], components = [] }) {
  const { analogPinIds, gndPinIds } = collectAnalogPinIds(analogComponents);

  // 1) Build adjacency for ALL wire endpoints (includes junction pins)
  const adj = new Map();
  const addEdge = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  };

  const allWirePairs = [];
  for (const w of wires || []) {
    const [a, b] = getWirePinIds(w);
    if (!a || !b) continue;
    allWirePairs.push([a, b]);
    addEdge(a, b);
  }

  // Include internal junction connectivity (junction IN/OUT pins are same net)
  const junctionEdges = [];
  for (const c of components || []) {
    if (c?.kind !== "JUNCTION") continue;
    const a = c?.pins?.[0]?.id;
    const b = c?.pins?.[1]?.id;
    if (!a || !b) continue;
    junctionEdges.push([a, b]);
    addEdge(a, b);
  }

  // 2) Find ALL pins reachable from analog pins (BFS)
  //    This pulls in junction pins that sit between analog pins.
  const reachable = new Set();
  const q = [];

  for (const pid of analogPinIds) {
    reachable.add(pid);
    q.push(pid);
  }

  while (q.length) {
    const cur = q.shift();
    const ns = adj.get(cur);
    if (!ns) continue;
    for (const nxt of ns) {
      if (!reachable.has(nxt)) {
        reachable.add(nxt);
        q.push(nxt);
      }
    }
  }

  // 3) Union all wire endpoints that are inside the reachable set
  const dsu = new DSU();
  for (const pid of reachable) dsu.make(pid);

  for (const [a, b] of allWirePairs) {
    if (reachable.has(a) && reachable.has(b)) dsu.union(a, b);
  }
  for (const [a, b] of junctionEdges) {
    if (reachable.has(a) && reachable.has(b)) dsu.union(a, b);
  }

  // 4) Group reachable pins by root
  const rootToPins = new Map();
  for (const pid of reachable) {
    const r = dsu.find(pid);
    if (!rootToPins.has(r)) rootToPins.set(r, []);
    rootToPins.get(r).push(pid);
  }

  // 5) Mark ground roots if they include any GND analog pin
  const groundRoots = new Set();
  for (const gpid of gndPinIds) {
    if (reachable.has(gpid)) groundRoots.add(dsu.find(gpid));
  }

  // 6) Assign node names, but only meaningful for nets that contain analog pins
  //    (junction-only nets aren't emitted unless they touch analog pins anyway)
  let counter = 1;
  const rootToNode = new Map();

  for (const [root, pins] of rootToPins) {
    // Only nets that touch at least one analog pin get a node name
    const touchesAnalog = pins.some((pid) => analogPinIds.has(pid));
    if (!touchesAnalog) continue;

    if (groundRoots.has(root)) rootToNode.set(root, SPICE_GROUND_NODE);
    else rootToNode.set(root, `n${counter++}`);
  }

  // 7) Final mapping for analog pins only
  const pinToNode = {};
  for (const pid of analogPinIds) {
    const r = dsu.find(pid);
    const node = rootToNode.get(r);
    if (node) pinToNode[pid] = node;
  }

  // 7b) Mapping for ALL pins in analog-touching nets (includes junction pins).
  // WHY: UI visuals may need node names for wires that end on junction pins.
  const pinToNodeAll = {};
  for (const [root, pins] of rootToPins) {
    const node = rootToNode.get(root);
    if (!node) continue;
    for (const pid of pins) pinToNodeAll[pid] = node;
  }

  // Debug nets: include all reachable pins in that net (includes junction pins)
  const nets = [];
  for (const [root, pins] of rootToPins) {
    const node = rootToNode.get(root);
    if (!node) continue;
    nets.push({
      node,
      pinIds: pins.slice(),
    });
  }

  return { pinToNode, pinToNodeAll, nets };
}
