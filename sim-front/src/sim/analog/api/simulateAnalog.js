// src/sim/analog/api/simulateAnalog.js

import { buildNodes } from "../netlist/buildNodes";
import { toSpiceNetlist } from "../netlist/toSpiceNetlist";
import { ANALOG_KIND, ANALOG_PART_DEFS } from "../model/analogTypes";

/**
 * Get a friendly component name for warnings/errors.
 * Shows ref if available, otherwise component type + shortened ID.
 *
 * @param {Object} component - The component object
 * @returns {string} - Friendly component name
 */
function getComponentDisplayName(component) {
    if (!component) return "Unknown component";

    // If component has a ref, use it
    if (component.ref) return component.ref;

    // Otherwise, show component type with shortened ID
    const partDef = ANALOG_PART_DEFS[component.kind];
    const componentType = partDef?.label || "Component";
    const shortId = component.id ? `...${component.id.slice(-6)}` : "";

    return shortId ? `${componentType} (${shortId})` : componentType;
}

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
 * Detect floating nodes using graph-based reachability analysis.
 *
 * WHY THIS WORKS:
 * - In a valid DC circuit, every node should have a path to ground (node "0")
 * - Components create connections between nodes (adjacency edges)
 * - BFS from ground marks all reachable nodes
 * - Any unmarked non-ground node is floating (no DC return path)
 *
 * WHY PIN COUNTING FAILS:
 * - Junction-aware nets include junction pins in pinIds (inflates count)
 * - Multiple floating pins can connect together (still floating, but >1 pin)
 * - A single floating capacitor creates a net with 1 pin, but two floating
 *   capacitors wired together create a net with 4 pins - both are still floating
 *
 * @param {Array} analogComponents - list of analog components
 * @param {Record<string,string>} pinToNode - mapping from pinId to node name
 * @returns {Array<string>} - list of floating node names
 */
function detectFloatingNodes(analogComponents, pinToNode) {
    // 1) Build node adjacency graph AND track component degree per node
    //    Each component connects all its nodes together (creates a path)
    const nodeAdjacency = new Map(); // nodeName -> Set<nodeName>
    const nodeDegree = new Map();     // nodeName -> number of components touching it
    const allNodes = new Set();

    for (const c of analogComponents || []) {
        if (!c || c.domain !== "analog") continue;

        // Skip ground components (they don't create connections, just mark node as "0")
        // Skip voltmeter (open-circuit measurement; should not create electrical connectivity)
        if (c.kind === ANALOG_KIND.GND || c.kind === ANALOG_KIND.VOLTMETER) continue;

        // Get all nodes this component touches
        const componentNodes = [];
        for (const pin of c.pins || []) {
            const nodeName = pinToNode[pin.id];
            if (nodeName) {
                componentNodes.push(nodeName);
                allNodes.add(nodeName);

                // Track degree: how many components touch this node
                nodeDegree.set(nodeName, (nodeDegree.get(nodeName) || 0) + 1);
            }
        }

        // Create edges between all pairs of nodes this component touches
        // WHY: A 2-pin component (R, C, L) connects node A to node B
        //      Multi-pin components connect all their nodes together
        for (let i = 0; i < componentNodes.length; i++) {
            for (let j = i + 1; j < componentNodes.length; j++) {
                const nodeA = componentNodes[i];
                const nodeB = componentNodes[j];

                if (!nodeAdjacency.has(nodeA)) nodeAdjacency.set(nodeA, new Set());
                if (!nodeAdjacency.has(nodeB)) nodeAdjacency.set(nodeB, new Set());

                nodeAdjacency.get(nodeA).add(nodeB);
                nodeAdjacency.get(nodeB).add(nodeA);
            }
        }
    }

    // 2) BFS from ground node "0" to find all reachable nodes
    const GROUND_NODE = "0";
    const reachableFromGround = new Set();
    const queue = [];

    // Start from ground if it exists in the circuit
    if (allNodes.has(GROUND_NODE)) {
        reachableFromGround.add(GROUND_NODE);
        queue.push(GROUND_NODE);
    }

    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = nodeAdjacency.get(current);

        if (!neighbors) continue;

        for (const neighbor of neighbors) {
            if (!reachableFromGround.has(neighbor)) {
                reachableFromGround.add(neighbor);
                queue.push(neighbor);
            }
        }
    }

    // 3) Find floating nodes using TWO criteria:
    //    A) Isolated islands: nodes not reachable from ground
    //    B) Dead-end nodes: nodes with only 1 component (no current return path)
    //
    //    WHY DEGREE CHECK IS NEEDED:
    //    - Node n2 in circuit "V1 → R1 → (n2)" is reachable from ground via R1→V1→GND
    //    - BUT it's a dead-end: only R1 touches n2, no return path for current
    //    - SPICE will fail on such nodes because DC solver needs current loops
    //
    //    Degree 1 means: only one component connects here → dead-end → floating
    const floatingNodes = [];
    for (const nodeName of allNodes) {
        // Skip ground itself
        if (nodeName === GROUND_NODE) continue;

        // Criterion A: Not reachable from ground (isolated island)
        if (!reachableFromGround.has(nodeName)) {
            floatingNodes.push(nodeName);
            continue;
        }

        // Criterion B: Dead-end node (degree = 1, only one component touches it)
        //              Even though reachable, can't form current loop
        const degree = nodeDegree.get(nodeName) || 0;
        if (degree === 1) {
            floatingNodes.push(nodeName);
        }
    }

    return floatingNodes;
}

/**
 * Frontend-only analog simulate "mock".
 * It DOES NOT run ngspice.
 * It only prepares the netlist + node mapping.
 *
 * This should be safe to call often (e.g. on-demand when user clicks "Analog → Export Netlist").
 */
export async function simulateAnalog({ analogComponents = [], wires = [], components = [], options = {} }) {
    const warnings = [];
    const errors = [];

    // 1) Build node mapping (pinId -> node)
    const nodes = buildNodes({ analogComponents, wires, components });

    // 2) Detect floating nodes using graph-based reachability from ground
    //    WHY: Simply counting pins per net is WRONG because:
    //    - Junction-aware buildNodes includes junction pins in pinIds
    //    - Multiple floating pins can be connected together (still floating)
    //    - A node is floating if it has NO PATH TO GROUND, regardless of pin count
    //
    //    APPROACH: Build node adjacency graph from component connections,
    //    then BFS from ground to mark all reachable nodes. Any non-reachable
    //    non-ground node is floating.
    const floatingNodes = detectFloatingNodes(analogComponents, nodes.pinToNode);
    for (const nodeName of floatingNodes) {
        warnings.push(`Node ${nodeName} is floating (no DC path to ground).`);
    }

    // 3) Basic validation (lightweight + non-breaking)
    //    Why: you want helpful messages early, without enforcing too much.
    for (const c of analogComponents || []) {
        if (!c) continue;

        // IMPORTANT: Only validate analog domain components
        // The caller might pass all circuit.components (including junctions, digital gates, etc.)
        // We must skip non-analog components to avoid false warnings
        if (c.domain !== "analog") continue;

        const displayName = getComponentDisplayName(c);

        // Missing ref/value warnings (netlist will still generate)
        if (!c.ref) {
            const partDef = ANALOG_PART_DEFS[c.kind];
            const exampleRef = partDef?.refPrefix ? `${partDef.refPrefix}1` : "R1";
            warnings.push(`${displayName} is missing ref (e.g., ${exampleRef}).`);
        }
        const value = c.props?.value;
        if (
            c.kind !== ANALOG_KIND.GND &&
            c.kind !== ANALOG_KIND.VOLTMETER &&
            c.kind !== ANALOG_KIND.AMMETER &&
            (value === undefined || value === null || value === "")
        ) {
            warnings.push(`${displayName} has empty value.`);
        }

        // Floating pins warning: pin not mapped -> means no wire connection (still ok)
        for (const p of c.pins || []) {
            if (!nodes.pinToNode[p.id]) {
                warnings.push(`${displayName} pin "${p.name}" is not connected (floating).`);
            }
        }
    }

    // 4) Build SPICE netlist text
    let netlist = "";
    try {
        netlist = toSpiceNetlist({
            analogComponents,
            pinToNode: nodes.pinToNode,
            options: {
                title: options.title || "Analog Circuit",
                analysis: options.analysis,
            },
        });
    } catch (e) {
        errors.push(`Failed to build netlist: ${e?.message || String(e)}`);
    }

    // 5) Send to backend
    let results = null;
    if (errors.length === 0) {
        try {
            const res = await fetch("http://localhost:8000/api/analog/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    netlist,
                    analysis: options.analysis || { type: "op" }
                })
            });
            
            if (!res.ok) {
                // Try to read error message
                try {
                    const errData = await res.json();
                    if (errData.detail) errors.push(errData.detail);
                    else if (errData.errors) errors.push(...errData.errors);
                    else errors.push(`Backend status ${res.status}`);
                } catch {
                    errors.push(`Backend status ${res.status}`);
                }
            } else {
                results = await res.json();
                if (!results.ok) {
                    errors.push(...(results.errors || []));
                }
            }
        } catch {
            warnings.push("Backend unreachable (is python server running?). Showing netlist only.");
        }
    }

    return {
        ok: errors.length === 0,
        netlist,
        nodes,
        warnings,
        errors,
        results, 
    };
}
