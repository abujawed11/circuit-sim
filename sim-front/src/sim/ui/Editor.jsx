import React, { useMemo, useState } from "react";
import { KIND, makeEmptyCircuit, LV, uid, makeICDefinition } from "../model/types";
import { makeComponent } from "../model/gates";
import { ANALOG_PART_DEFS, ANALOG_KIND } from "../analog/model/analogTypes";
import { makeAnalogComponent } from "../analog/model/analogParts";
import Canvas from "./Canvas";
import ICCreationDialog from "./ICCreationDialog";
import PropertiesPanel from "./PropertiesPanel";
import { simulate } from "../engine/simulate";
import { simulateAnalog } from "../analog/api/simulateAnalog";
import { ANALOG_DOMAIN } from "../analog/model/analogTypes"; // "analog"

const palette = [
    { kind: KIND.INPUT, label: "Input" },
    { kind: KIND.BUTTON, label: "Button" },
    { kind: KIND.VCC, label: "VCC" },
    { kind: KIND.GND, label: "GND" },
    { kind: KIND.LED, label: "LED" },
    { kind: KIND.PROBE, label: "Probe" },
    { kind: KIND.CLOCK, label: "Clock" },
    { kind: KIND.NOT, label: "NOT" },
    { kind: KIND.AND, label: "AND" },
    { kind: KIND.OR, label: "OR" },
    { kind: KIND.XOR, label: "XOR" },
    { kind: KIND.NAND, label: "NAND" },
    { kind: KIND.NOR, label: "NOR" },
    { kind: KIND.XNOR, label: "XNOR" },
    { kind: KIND.SR_LATCH, label: "SR Latch" },
    { kind: KIND.D_FF, label: "D Flip-Flop" },
    { kind: KIND.JK_FF, label: "JK Flip-Flop" },
];

const STORAGE_KEY = "circuit-sim-state";

// Load circuit from localStorage
const loadCircuitFromStorage = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed;
        }
    } catch (err) {
        console.error("Failed to load circuit:", err);
    }
    return makeEmptyCircuit();
};

// Save circuit to localStorage
const saveCircuitToStorage = (circuit) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(circuit));
    } catch (err) {
        console.error("Failed to save circuit:", err);
    }
};

export default function Editor() {
    const [circuit, setCircuit] = useState(() => loadCircuitFromStorage());
    const [simTick, setSimTick] = useState(0);

    const [selectedKind, setSelectedKind] = useState(KIND.AND);
    const [history, setHistory] = useState([loadCircuitFromStorage()]);
    const [historyIndex, setHistoryIndex] = useState(0);


    const [paletteQuery, setPaletteQuery] = useState("");
    const [icCreationDialog, setIcCreationDialog] = useState(null); // { selectedCompIds, selectedWireIds }

    const [currentSelection, setCurrentSelection] = useState({
        compIds: [],
        wireIds: [],
    });

    const [propertiesSelection, setPropertiesSelection] = useState(null); // { compIds: [id], wireIds: [] } | null


    // Put this inside your Editor component:
    const handleTestAnalog = async () => {
        try {
            const analogComponents = (circuit.components || []).filter(
                (c) => c?.domain === ANALOG_DOMAIN
            );

            if (analogComponents.length === 0) {
                alert("No analog components found. Place R/C/L/VDC/GND first.");
                return;
            }

            const res = await simulateAnalog({
                analogComponents,
                wires: circuit.wires || [],
                options: { title: "Analog Frontend Test" },
            });

            // Pretty debug output
            console.group("🔌 Analog Test (Frontend Only)");
            console.log("ok:", res.ok);
            if (res.errors?.length) console.error("Errors:", res.errors);
            if (res.warnings?.length) console.warn("Warnings:", res.warnings);

            console.log("Pin → Node map:", res.nodes?.pinToNode);
            console.log("Nets:", res.nodes?.nets);
            console.log("Netlist:\n" + res.netlist);
            console.groupEnd();

            // Quick UI feedback
            if (!res.ok) {
                alert("Analog netlist build failed.\n\n" + (res.errors || []).join("\n"));
                return;
            }

            // Optional: show netlist quickly
            alert(res.netlist);
        } catch (e) {
            console.error("Analog test crashed:", e);
            alert("Analog test crashed: " + (e?.message || String(e)));
        }
    };



    // Auto-save circuit to localStorage whenever it changes
    React.useEffect(() => {
        saveCircuitToStorage(circuit);
    }, [circuit]);

    React.useEffect(() => {
        const id = setInterval(() => {
            setSimTick(t => t + 1);
        }, 50); // 20 Hz simulation
        return () => clearInterval(id);
    }, []);


    const groupedPalette = useMemo(() => {
        const groups = [
            {
                title: "I/O",
                items: [
                    { kind: KIND.INPUT, label: "Input", short: "IN", hint: "Toggle 0/1" },
                    { kind: KIND.BUTTON, label: "Button", short: "BTN", hint: "Momentary press" },
                    { kind: KIND.VCC, label: "VCC", short: "1", hint: "Always HIGH" },
                    { kind: KIND.GND, label: "GND", short: "0", hint: "Always LOW" },
                    { kind: KIND.LED, label: "LED", short: "OUT", hint: "Shows signal" },
                    { kind: KIND.PROBE, label: "Probe", short: "DBG", hint: "0/1/X read" },
                    { kind: KIND.SEVEN_SEGMENT, label: "7-Segment", short: "7SEG", hint: "Display" },
                    { kind: KIND.JUNCTION, label: "Junction", short: "NET", hint: "Split wire" },
                ],
            },
            {
                title: "Gates",
                items: [
                    { kind: KIND.NOT, label: "NOT", short: "¬", hint: "Invert" },
                    { kind: KIND.AND, label: "AND", short: "∧", hint: "All 1" },
                    { kind: KIND.OR, label: "OR", short: "∨", hint: "Any 1" },
                    { kind: KIND.XOR, label: "XOR", short: "⊕", hint: "Different" },
                    { kind: KIND.NAND, label: "NAND", short: "⊼" },
                    { kind: KIND.NOR, label: "NOR", short: "⊽" },
                    { kind: KIND.XNOR, label: "XNOR", short: "≡" },
                    { kind: KIND.BUFFER, label: "Buffer (Delay)", short: "BUF", hint: "Delay line" },

                ],
            },
            {
                title: "Plexers",
                items: [
                    { kind: "MUX_2", label: "MUX 2:1", short: "MUX", hint: "Select 1 of 2" },
                    { kind: "MUX_4", label: "MUX 4:1", short: "MUX", hint: "Select 1 of 4" },
                    { kind: "MUX_8", label: "MUX 8:1", short: "MUX", hint: "Select 1 of 8" },
                    { kind: "DEMUX_2", label: "DEMUX 1:2", short: "DMX", hint: "Route to 1 of 2" },
                    { kind: "DEMUX_4", label: "DEMUX 1:4", short: "DMX", hint: "Route to 1 of 4" },
                    { kind: "DEMUX_8", label: "DEMUX 1:8", short: "DMX", hint: "Route to 1 of 8" },
                    { kind: "DECODER_4", label: "Decoder 2:4", short: "DEC", hint: "2 In -> 4 Out" },
                    { kind: "DECODER_8", label: "Decoder 3:8", short: "DEC", hint: "3 In -> 8 Out" },
                    { kind: "PRIORITY_ENCODER_4", label: "P-Enc 4:2", short: "ENC", hint: "4 In -> 2 Out" },
                    { kind: "PRIORITY_ENCODER_8", label: "P-Enc 8:3", short: "ENC", hint: "8 In -> 3 Out" },
                    { kind: KIND.BCD_7SEG, label: "BCD Decoder", short: "7SEG", hint: "0-F -> 7-segment" },

                ],
            },
            {
                title: "Sequential",
                items: [
                    { kind: KIND.CLOCK, label: "Clock", short: "CLK", hint: "Auto toggle" },
                    { kind: KIND.SR_LATCH, label: "SR Latch", short: "SR" },
                    { kind: KIND.D_FF, label: "D Flip-Flop", short: "DFF" },
                    { kind: KIND.JK_FF, label: "JK Flip-Flop", short: "JK" },
                    { kind: KIND.T_FF, label: "T Flip-Flop", short: "TFF" },
                    { kind: KIND.TIMER_555, label: "555 Timer", short: "555", hint: "8-pin timer IC" },

                ],
            },
            {
                title: "Analog",
                items: [
                    { kind: ANALOG_KIND.R, label: ANALOG_PART_DEFS[ANALOG_KIND.R].label, short: "R", hint: ANALOG_PART_DEFS[ANALOG_KIND.R].defaultValue },
                    { kind: ANALOG_KIND.C, label: ANALOG_PART_DEFS[ANALOG_KIND.C].label, short: "C", hint: ANALOG_PART_DEFS[ANALOG_KIND.C].defaultValue },
                    { kind: ANALOG_KIND.L, label: ANALOG_PART_DEFS[ANALOG_KIND.L].label, short: "L", hint: ANALOG_PART_DEFS[ANALOG_KIND.L].defaultValue },
                    { kind: ANALOG_KIND.VDC, label: "VDC", short: "V", hint: ANALOG_PART_DEFS[ANALOG_KIND.VDC].defaultValue },
                    { kind: ANALOG_KIND.GND, label: "GND", short: "0", hint: "Node 0" },
                ],
            },
        ];

        // ✅ Add Custom ICs Group
        if (circuit.icDefinitions && circuit.icDefinitions.length > 0) {
            groups.push({
                title: "Custom ICs",
                items: circuit.icDefinitions.map((ic) => ({
                    kind: `IC_${ic.id}`, // Dynamic KIND based on IC ID
                    label: ic.name,
                    short: "IC",
                    hint: `${ic.inputPins.length} IN → ${ic.outputPins.length} OUT`,
                    isCustomIC: true,
                    icDefId: ic.id,
                })),
            });
        }

        const q = paletteQuery.trim().toLowerCase();
        if (!q) return groups;

        return groups
            .map((g) => ({
                ...g,
                items: g.items.filter((it) => it.label.toLowerCase().includes(q)),
            }))
            .filter((g) => g.items.length > 0);
    }, [paletteQuery, circuit.icDefinitions]);

    const filteredGroups = groupedPalette;


    // const simulated = useMemo(() => {
    //     const clone = structuredClone(circuit);
    //     simulate(clone);
    //     return clone;
    // }, [circuit]);

    const simulated = useMemo(() => {
        const clone = structuredClone(circuit);
        // Keep analog separate from digital simulation:
        // - simulate() should only see digital pins/wires
        const analogComponents = clone.components.filter((c) => c?.domain === "analog");
        const analogPinIds = new Set();
        for (const c of analogComponents) {
            for (const p of c?.pins || []) analogPinIds.add(p.id);
        }
        const analogWires = clone.wires.filter(
            (w) => analogPinIds.has(w.fromPinId) || analogPinIds.has(w.toPinId)
        );

        clone.components = clone.components.filter((c) => c?.domain !== "analog");
        clone.wires = clone.wires.filter(
            (w) => !analogPinIds.has(w.fromPinId) && !analogPinIds.has(w.toPinId)
        );

        simulate(clone);

        // Re-attach analog for rendering/editor state (no digital LV propagation into analog)
        clone.components.push(...analogComponents);
        clone.wires.push(...analogWires);
        return clone;
    }, [circuit, simTick]);

    // Close properties if the target component is deleted
    React.useEffect(() => {
        if (!propertiesSelection?.compIds?.length) return;
        const compId = propertiesSelection.compIds[0];
        const exists = circuit.components.some((c) => c.id === compId);
        if (!exists) setPropertiesSelection(null);
    }, [circuit, propertiesSelection]);


    // Clock ticker
    React.useEffect(() => {
        const interval = setInterval(() => {
            setCircuit((prev) => {
                const now = Date.now();
                let changed = false;

                // Check if any clock needs toggling
                const nextComponents = prev.components.map((c) => {
                    if (c.kind === KIND.CLOCK && c.state.mode !== "MANUAL") {
                        const period = c.state.interval || 1000;
                        const lastTick = c.state.lastTick || 0;

                        if (now - lastTick >= period) {
                            changed = true;
                            return {
                                ...c,
                                state: {
                                    ...c.state,
                                    value: c.state.value === LV.HIGH ? LV.LOW : LV.HIGH,
                                    lastTick: now,
                                },
                            };
                        }
                    }
                    return c;
                });

                if (changed) {
                    return { ...prev, components: nextComponents };
                }
                return prev;
            });
        }, 50);
        return () => clearInterval(interval);
    }, []);

    // Sequential logic write-back (persist simulation state)
    React.useEffect(() => {
        const prevComponentById = new Map(circuit.components.map((c) => [c.id, c]));

        const internalCircuitStateEquals = (a, b, depth = 0) => {
            if (!a && !b) return true;
            if (!a || !b) return false;
            if (depth > 5) return true; // prevent pathological recursion

            const aComps = Array.isArray(a.components) ? a.components : [];
            const bComps = Array.isArray(b.components) ? b.components : [];
            if (aComps.length !== bComps.length) return false;

            const aById = new Map(aComps.map((c) => [c.id, c]));
            for (const bc of bComps) {
                const ac = aById.get(bc.id);
                if (!ac || ac.kind !== bc.kind) return false;

                const as = ac.state || {};
                const bs = bc.state || {};

                // Compare ONLY "memory" state that must persist across ticks.
                if (
                    bc.kind === KIND.SR_LATCH ||
                    bc.kind === KIND.D_FF ||
                    bc.kind === KIND.JK_FF ||
                    bc.kind === KIND.T_FF
                ) {
                    if (as.q !== bs.q) return false;
                    if (as.lastClk !== bs.lastClk) return false;
                }

                if (bc.kind === KIND.BUFFER) {
                    const aq = Array.isArray(as.queue) ? as.queue : [];
                    const bq = Array.isArray(bs.queue) ? bs.queue : [];
                    if (aq.length !== bq.length) return false;
                    for (let i = 0; i < aq.length; i++) {
                        if (aq[i] !== bq[i]) return false;
                    }
                }

                if (bc.kind === KIND.TIMER_555) {
                    if (as.latch !== bs.latch) return false;
                    if (as.lastTrig !== bs.lastTrig) return false;
                    if (as.monoEndAt !== bs.monoEndAt) return false;
                }

                if (bc.kind === "IC_CUSTOM") {
                    if (!internalCircuitStateEquals(as.internalCircuit, bs.internalCircuit, depth + 1)) {
                        return false;
                    }
                }
            }
            return true;
        };

        let changed = false;
        const nextComponents = simulated.components.map((c) => {
            const state = c.state || {};
            let nextState = { ...state };
            let hasUpdate = false;

            if (state._nextQ !== undefined && state._nextQ !== state.q) {
                nextState.q = state._nextQ;
                delete nextState._nextQ;
                hasUpdate = true;
            }
            if (
                state._nextLastClk !== undefined &&
                state._nextLastClk !== state.lastClk
            ) {
                nextState.lastClk = state._nextLastClk;
                delete nextState._nextLastClk;
                hasUpdate = true;
            }

            if (c.kind === KIND.BUFFER) {
                // ensure queue exists
                const q = Array.isArray(state.queue) ? state.queue : [];
                // Always persist queue so delay advances across frames
                nextState.queue = q;
                hasUpdate = true;
            }

            // ✅ NEW: persist 555 monostable state
            if (c.kind === KIND.TIMER_555) {
                nextState.latch = state.latch;
                nextState.lastTrig = state.lastTrig;
                nextState.monoEndAt = state.monoEndAt;
                hasUpdate = true;
            }

            // Persist IC internal circuit state (required for sequential logic inside custom ICs)
            if (c.kind === "IC_CUSTOM") {
                const prevComp = prevComponentById.get(c.id);
                const prevInternal = prevComp?.state?.internalCircuit ?? null;
                const nextInternal = c.state?.internalCircuit ?? null;

                if (!internalCircuitStateEquals(prevInternal, nextInternal)) {
                    nextState.internalCircuit = nextInternal;
                    hasUpdate = true;
                }
            }

            if (hasUpdate) {
                changed = true;
                return { ...c, state: nextState };
            }
            return c;
        });

        // if (changed) {
        //     setCircuit((prev) => ({ ...prev, components: nextComponents }));
        // }

        if (!changed) return;

        setCircuit((prev) => {
            // If nothing actually changed compared to prev, return prev (prevents render loop)
            let anyRealChange = false;

            const prevById = new Map(prev.components.map((c) => [c.id, c]));

            const merged = prev.components.map((pc) => {
                const sc = nextComponents.find((x) => x.id === pc.id);
                if (!sc) return pc;

                // Compare ONLY state fields you want to persist (q/lastClk + buffer queue)
                const ps = pc.state || {};
                const ns = sc.state || {};

                const sameQ = ps.q === ns.q;
                const sameLastClk = ps.lastClk === ns.lastClk;

                const pq = Array.isArray(ps.queue) ? ps.queue : null;
                const nq = Array.isArray(ns.queue) ? ns.queue : null;
                const sameQueue =
                    pq === null && nq === null
                        ? true
                        : pq && nq && pq.length === nq.length && pq.every((v, i) => v === nq[i]);

                const sameInternalState =
                    pc.kind === "IC_CUSTOM"
                        ? internalCircuitStateEquals(ps.internalCircuit, ns.internalCircuit)
                        : true;

                if (sameQ && sameLastClk && sameQueue && sameInternalState) return pc;

                anyRealChange = true;

                // Merge state, including internal circuit for ICs
                const mergedState = { ...pc.state, ...ns };

                return { ...pc, state: mergedState };
            });

            return anyRealChange ? { ...prev, components: merged } : prev;
        });

    }, [simulated]);

    const updateCircuit = (newCircuit) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newCircuit);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setCircuit(newCircuit);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setCircuit(history[newIndex]);
        }
    };

    // const simulated = useMemo(() => {
    //     const clone = structuredClone(circuit);
    //     simulate(clone);
    //     return clone;
    // }, [circuit]);

    const moveComponent = (compId, x, y, addToHistory = true) => {
        const next = structuredClone(circuit);
        const c = next.components.find((cc) => cc.id === compId);
        if (c) {
            c.x = x;
            c.y = y;
        }
        if (addToHistory) {
            updateCircuit(next);
        } else {
            // Preview only, don't add to history
            setCircuit(next);
        }
    };

    const moveComponents = (moves, addToHistory = true) => {
        if (!Array.isArray(moves) || moves.length === 0) return;
        const next = structuredClone(circuit);
        for (const m of moves) {
            const compId = m?.compId ?? m?.id;
            if (!compId) continue;
            const c = next.components.find((cc) => cc.id === compId);
            if (!c) continue;
            if (typeof m.x === "number") c.x = m.x;
            if (typeof m.y === "number") c.y = m.y;
        }
        if (addToHistory) {
            updateCircuit(next);
        } else {
            setCircuit(next);
        }
    };

    const deleteComponent = (compId) => {
        const next = structuredClone(circuit);
        const comp = next.components.find((c) => c.id === compId);
        if (!comp) return;
        const pinIds = new Set(comp.pins.map((p) => p.id));
        next.components = next.components.filter((c) => c.id !== compId);
        next.wires = next.wires.filter(
            (w) => !pinIds.has(w.fromPinId) && !pinIds.has(w.toPinId)
        );
        updateCircuit(next);
    };

    const duplicateComponent = (compIdOrIds) => {
        const ids = Array.isArray(compIdOrIds) ? compIdOrIds : [compIdOrIds];
        const compIds = [...new Set(ids)].filter(Boolean);
        if (compIds.length === 0) return;

        const dx = 24;
        const dy = 24;

        const next = structuredClone(circuit);
        const originalWires = next.wires.slice();

        const pinIdMap = new Map(); // oldPinId -> newPinId
        const selectedPinIds = new Set();

        const srcComps = compIds
            .map((id) => next.components.find((c) => c.id === id))
            .filter(Boolean);

        for (const src of srcComps) {
            for (const p of src.pins || []) selectedPinIds.add(p.id);
        }

        const copies = [];
        for (const src of srcComps) {
            const copy = structuredClone(src);
            copy.id = uid();
            copy.x = (copy.x ?? 0) + dx;
            copy.y = (copy.y ?? 0) + dy;

            if (copy.kind === "IC_CUSTOM" && copy.state) {
                copy.state.internalCircuit = null;
            }

            const srcPins = Array.isArray(src.pins) ? src.pins : [];
            copy.pins = srcPins.map((p) => ({ ...structuredClone(p), id: uid() }));
            for (let i = 0; i < srcPins.length; i++) {
                pinIdMap.set(srcPins[i].id, copy.pins[i].id);
            }

            copies.push(copy);
        }

        next.components.push(...copies);

        // Duplicate internal wires (only those fully contained in the selected components)
        for (const w of originalWires) {
            if (!selectedPinIds.has(w.fromPinId) || !selectedPinIds.has(w.toPinId)) continue;
            const fromPinId = pinIdMap.get(w.fromPinId);
            const toPinId = pinIdMap.get(w.toPinId);
            if (!fromPinId || !toPinId) continue;

            const points = Array.isArray(w.points)
                ? w.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }))
                : [];

            next.wires.push({
                ...structuredClone(w),
                id: uid(),
                fromPinId,
                toPinId,
                points,
            });
        }

        updateCircuit(next);
    };

    // const deleteWire = (wireId) => {
    //     const next = structuredClone(circuit);
    //     next.wires = next.wires.filter((w) => w.id !== wireId);
    //     updateCircuit(next);
    // };

    const deleteWire = (wireId) => {
        const next = structuredClone(circuit);

        const wire = next.wires.find((w) => w.id === wireId);
        if (!wire) return;

        const findPinMeta = (pinId) => {
            for (const c of next.components) {
                const p = c.pins.find((pp) => pp.id === pinId);
                if (p) return { comp: c, pin: p };
            }
            return null;
        };

        const A = findPinMeta(wire.fromPinId);
        const B = findPinMeta(wire.toPinId);

        // Always delete the clicked wire
        let idsToDelete = new Set([wireId]);

        // ✅ If it's a junction<->junction "bidirectional pair", delete the reverse too
        if (A?.comp?.kind === KIND.JUNCTION && B?.comp?.kind === KIND.JUNCTION) {
            // Reverse wire will be: (B.OUT -> A.IN) if current is (A.OUT -> B.IN)
            const aIn = A.comp.pins.find((p) => p.name === "IN")?.id;
            const aOut = A.comp.pins.find((p) => p.name === "OUT")?.id;
            const bIn = B.comp.pins.find((p) => p.name === "IN")?.id;
            const bOut = B.comp.pins.find((p) => p.name === "OUT")?.id;

            if (aIn && aOut && bIn && bOut) {
                // Identify which direction this wire is, then compute reverse
                let revFrom, revTo;

                if (wire.fromPinId === aOut && wire.toPinId === bIn) {
                    revFrom = bOut;
                    revTo = aIn;
                } else if (wire.fromPinId === bOut && wire.toPinId === aIn) {
                    revFrom = aOut;
                    revTo = bIn;
                }

                if (revFrom && revTo) {
                    const rev = next.wires.find((w) => w.fromPinId === revFrom && w.toPinId === revTo);
                    if (rev) idsToDelete.add(rev.id);
                }
            }
        }

        next.wires = next.wires.filter((w) => !idsToDelete.has(w.id));
        updateCircuit(next);
    };


    // const deleteMultiple = (compIds = [], wireIds = []) => {
    //     const next = structuredClone(circuit);

    //     // Collect all pin IDs from components to be deleted
    //     const pinIdsToDelete = new Set();
    //     compIds.forEach(compId => {
    //         const comp = next.components.find(c => c.id === compId);
    //         if (comp) {
    //             comp.pins.forEach(p => pinIdsToDelete.add(p.id));
    //         }
    //     });

    //     // Delete components
    //     next.components = next.components.filter(c => !compIds.includes(c.id));

    //     // Delete wires (both explicitly selected and connected to deleted components)
    //     next.wires = next.wires.filter(w =>
    //         !wireIds.includes(w.id) &&
    //         !pinIdsToDelete.has(w.fromPinId) &&
    //         !pinIdsToDelete.has(w.toPinId)
    //     );

    //     updateCircuit(next);
    // };

    const deleteMultiple = (compIds = [], wireIds = []) => {
        const next = structuredClone(circuit);

        // helper: find comp+pin for a pinId
        const findPinMeta = (pinId) => {
            for (const c of next.components) {
                const p = c.pins.find(pp => pp.id === pinId);
                if (p) return { comp: c, pin: p };
            }
            return null;
        };

        // Expand wireIds to also include reverse pair for junction<->junction wires
        const wireIdsToDelete = new Set(wireIds);

        for (const wid of wireIds) {
            const w = next.wires.find(x => x.id === wid);
            if (!w) continue;

            const A = findPinMeta(w.fromPinId);
            const B = findPinMeta(w.toPinId);

            if (A?.comp?.kind !== KIND.JUNCTION || B?.comp?.kind !== KIND.JUNCTION) continue;

            const aIn = A.comp.pins.find(p => p.name === "IN")?.id;
            const aOut = A.comp.pins.find(p => p.name === "OUT")?.id;
            const bIn = B.comp.pins.find(p => p.name === "IN")?.id;
            const bOut = B.comp.pins.find(p => p.name === "OUT")?.id;
            if (!aIn || !aOut || !bIn || !bOut) continue;

            let revFrom, revTo;

            if (w.fromPinId === aOut && w.toPinId === bIn) {
                revFrom = bOut; revTo = aIn;
            } else if (w.fromPinId === bOut && w.toPinId === aIn) {
                revFrom = aOut; revTo = bIn;
            } else {
                continue;
            }

            const rev = next.wires.find(x => x.fromPinId === revFrom && x.toPinId === revTo);
            if (rev) wireIdsToDelete.add(rev.id);
        }

        // Collect all pin IDs from components to be deleted
        const pinIdsToDelete = new Set();
        compIds.forEach(compId => {
            const comp = next.components.find(c => c.id === compId);
            if (comp) comp.pins.forEach(p => pinIdsToDelete.add(p.id));
        });

        // Delete components
        next.components = next.components.filter(c => !compIds.includes(c.id));

        // Delete wires:
        // - selected wire IDs (plus their reverse pair)
        // - wires connected to deleted component pins
        next.wires = next.wires.filter(w =>
            !wireIdsToDelete.has(w.id) &&
            !pinIdsToDelete.has(w.fromPinId) &&
            !pinIdsToDelete.has(w.toPinId)
        );

        updateCircuit(next);
    };




    const addAt = (x, y, kind) => {
        const next = structuredClone(circuit);

        if (typeof kind === "string" && kind.startsWith("A_")) {
            // next.components.push(makeAnalogComponent(kind, x, y));
            next.components.push(makeAnalogComponent(kind, x, y, next.components));

            updateCircuit(next);
            return;
        }

        if (kind.startsWith("IC_")) {
            const icDefId = kind.replace("IC_", "");
            const icDef = next.icDefinitions.find(d => d.id === icDefId);

            if (icDef) {
                // Calculate dynamic height based on pins
                const maxPins = Math.max(icDef.inputPins.length, icDef.outputPins.length);
                const h = Math.max(80, maxPins * 20 + 40); // Minimal height or dynamic

                const newComp = {
                    id: uid(),
                    kind: "IC_CUSTOM",
                    icDefinitionId: icDefId,
                    x,
                    y,
                    w: 120, // Standard width
                    h: h,
                    pins: [
                        ...icDef.inputPins.map(p => ({ id: uid(), name: p.name, dir: "in", value: LV.X })),
                        ...icDef.outputPins.map(p => ({ id: uid(), name: p.name, dir: "out", value: LV.X }))
                    ],
                    state: {
                        internalCircuit: null // Will be populated by simulator
                    }
                };
                next.components.push(newComp);
            }
        } else if (kind.startsWith("MUX_") || kind.startsWith("DEMUX_")) {
            const [baseKind, sizeStr] = kind.split("_");
            const size = parseInt(sizeStr);
            const comp = makeComponent(baseKind === "MUX" ? KIND.MUX : KIND.DEMUX, x, y);

            comp.props = { size };
            comp.h = Math.max(80, size * 24 + 30);

            // Regenerate pins for the specific size
            const selectCount = Math.log2(size);
            const pins = [];

            if (baseKind === "MUX") {
                for (let i = 0; i < size; i++) pins.push({ id: uid(), name: `I${i}`, dir: "in", value: LV.X });
                for (let i = 0; i < selectCount; i++) pins.push({ id: uid(), name: `S${i}`, dir: "in", value: LV.X });
                pins.push({ id: uid(), name: "Y", dir: "out", value: LV.X });
            } else {
                pins.push({ id: uid(), name: "I", dir: "in", value: LV.X });
                for (let i = 0; i < selectCount; i++) pins.push({ id: uid(), name: `S${i}`, dir: "in", value: LV.X });
                for (let i = 0; i < size; i++) pins.push({ id: uid(), name: `Y${i}`, dir: "out", value: LV.X });
            }
            comp.pins = pins;
            next.components.push(comp);
        } else if (kind.startsWith("DECODER_") || kind.startsWith("PRIORITY_ENCODER_")) {
            const lastUnderscore = kind.lastIndexOf("_");
            const baseKind = kind.substring(0, lastUnderscore); // "DECODER" or "PRIORITY_ENCODER"
            const size = parseInt(kind.substring(lastUnderscore + 1));

            const realKind = baseKind === "DECODER" ? KIND.DECODER : KIND.PRIORITY_ENCODER;
            const comp = makeComponent(realKind, x, y);
            comp.props = { size };
            comp.h = Math.max(80, size * 20 + 20);

            if (realKind === KIND.DECODER) {
                const inputCount = Math.log2(size);
                const pins = [];
                for (let i = 0; i < inputCount; i++) pins.push({ id: uid(), name: `A${i}`, dir: "in", value: LV.X });
                for (let i = 0; i < size; i++) pins.push({ id: uid(), name: `Y${i}`, dir: "out", value: LV.X });
                comp.pins = pins;
            } else {
                const outputCount = Math.log2(size);
                const pins = [];
                for (let i = 0; i < size; i++) pins.push({ id: uid(), name: `D${i}`, dir: "in", value: LV.X });
                for (let i = 0; i < outputCount; i++) pins.push({ id: uid(), name: `Q${i}`, dir: "out", value: LV.X });
                pins.push({ id: uid(), name: "V", dir: "out", value: LV.X });
                comp.pins = pins;
            }
            next.components.push(comp);
        } else {
            next.components.push(makeComponent(kind, x, y));
        }

        updateCircuit(next);
    };

    const toggleInput = (compId) => {
        const next = structuredClone(circuit);
        const c = next.components.find((cc) => cc.id === compId);
        if (c?.kind === KIND.INPUT) {
            c.state.value = c.state.value === LV.HIGH ? LV.LOW : LV.HIGH;
        }
        updateCircuit(next);
    };

    const setComponentValue = (compId, value) => {
        setCircuit((prev) => {
            const next = structuredClone(prev);
            const c = next.components.find((cc) => cc.id === compId);
            if (c) {
                c.state.value = value;
            }
            return next;
        });
    };

    const setButtonPressed = (compId, pressed) => {
        setCircuit((prev) => {
            const next = structuredClone(prev);
            const c = next.components.find((cc) => cc.id === compId);
            if (c && c.kind === KIND.BUTTON) {
                c.state.pressed = pressed;
            }
            return next;
        });
    };

    const toggleClockMode = (compId) => {
        const next = structuredClone(circuit);
        const c = next.components.find((cc) => cc.id === compId);
        if (c?.kind === KIND.CLOCK) {
            c.state.mode = c.state.mode === "MANUAL" ? "AUTO" : "MANUAL";
        }
        updateCircuit(next);
    };

    const handleComponentUpdate = (updatedComp) => {
        const next = structuredClone(circuit);
        const idx = next.components.findIndex((c) => c.id === updatedComp.id);
        if (idx !== -1) {
            next.components[idx] = updatedComp;
            updateCircuit(next);
        }
    };

    const rotateComponent = (compId, direction = 1) => {
        const next = structuredClone(circuit);
        const c = next.components.find((cc) => cc.id === compId);
        if (c) {
            // Update rotation (0..3)
            c.rotate = ((c.rotate || 0) + direction + 4) % 4;

            // Swap w/h for 90 degree turns
            // Actually, we don't swap w/h in the model, we just render rotated.
            // BUT, if we swap w/h here, hit testing and pin positioning logic might need less changing?
            // No, purely visual rotation is better, but pin position logic needs to account for it.
            // Let's stick to just setting 'rotate' property for now.
        }
        updateCircuit(next);
    };

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === "INPUT") return; // Ignore if typing in input

            if (e.key.toLowerCase() === "r") {
                if (currentSelection.compIds.length > 0) {
                    // Rotate all selected
                    const next = structuredClone(circuit);
                    let changed = false;
                    for (const id of currentSelection.compIds) {
                        const c = next.components.find(cc => cc.id === id);
                        if (c) {
                            c.rotate = ((c.rotate || 0) + 1) % 4;
                            changed = true;
                        }
                    }
                    if (changed) updateCircuit(next);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [circuit, currentSelection]);


    // NEW: connect output pin -> input pin

    // const connectPins = (aPinId, bPinId, points = []) => {
    //     const next = structuredClone(circuit);

    //     const findPinMeta = (pinId) => {
    //         for (const c of next.components) {
    //             const p = c.pins.find((pp) => pp.id === pinId);
    //             if (p) return { comp: c, pin: p };
    //         }
    //         return null;
    //     };

    //     const A = findPinMeta(aPinId);
    //     const B = findPinMeta(bPinId);
    //     if (!A || !B) return;

    //     // ✅ Decide correct direction OUT -> IN regardless of click order
    //     let fromPinId, toPinId;
    //     let finalPoints = points;

    //     if (A.pin.dir === "out" && B.pin.dir === "in") {
    //         fromPinId = aPinId;
    //         toPinId = bPinId;
    //         // Pins in correct order, points stay as-is
    //     } else if (A.pin.dir === "in" && B.pin.dir === "out") {
    //         fromPinId = bPinId;
    //         toPinId = aPinId;
    //         // Pins swapped, reverse points to maintain path
    //         finalPoints = [...points].reverse();
    //     } else {
    //         // IN->IN or OUT->OUT not allowed (prevents blue confusion)
    //         return;
    //     }

    //     // Allow multiple wires to same input (like other simulators)
    //     // Conflicts will be handled in simulation logic
    //     const exists = next.wires.some(
    //         (w) => w.fromPinId === fromPinId && w.toPinId === toPinId
    //     );
    //     if (!exists) {
    //         next.wires.push({
    //             id: uid(),
    //             fromPinId,
    //             toPinId,
    //             points: finalPoints,
    //         });
    //     }

    //     updateCircuit(next);
    // };


    // const connectPins = (aPinId, bPinId, points = []) => {
    //     const next = structuredClone(circuit);

    //     // Find which component + pin belongs to a given pinId
    //     const findPinMeta = (pinId) => {
    //         for (const c of next.components) {
    //             const p = c.pins.find((pp) => pp.id === pinId);
    //             if (p) return { comp: c, pin: p };
    //         }
    //         return null;
    //     };

    //     const A = findPinMeta(aPinId);
    //     const B = findPinMeta(bPinId);
    //     if (!A || !B) return;

    //     const wireExists = (fromPinId, toPinId) =>
    //         next.wires.some((w) => w.fromPinId === fromPinId && w.toPinId === toPinId);

    //     // ✅ SPECIAL CASE: Junction <-> Junction should behave like a simple wire (bidirectional)
    //     if (A.comp.kind === KIND.JUNCTION && B.comp.kind === KIND.JUNCTION) {
    //         const aIn = A.comp.pins.find((p) => p.name === "IN");
    //         const aOut = A.comp.pins.find((p) => p.name === "OUT");
    //         const bIn = B.comp.pins.find((p) => p.name === "IN");
    //         const bOut = B.comp.pins.find((p) => p.name === "OUT");
    //         if (!aIn || !aOut || !bIn || !bOut) return;

    //         // A -> B
    //         if (!wireExists(aOut.id, bIn.id)) {
    //             next.wires.push({
    //                 id: uid(),
    //                 fromPinId: aOut.id,
    //                 toPinId: bIn.id,
    //                 points,
    //             });
    //         }

    //         // B -> A (reverse)
    //         if (!wireExists(bOut.id, aIn.id)) {
    //             next.wires.push({
    //                 id: uid(),
    //                 fromPinId: bOut.id,
    //                 toPinId: aIn.id,
    //                 points: [...points].reverse(),
    //             });
    //         }

    //         updateCircuit(next);
    //         return;
    //     }

    //     // ✅ Default rule: Only allow OUT -> IN for normal components
    //     let fromPinId, toPinId;
    //     let finalPoints = points;

    //     if (A.pin.dir === "out" && B.pin.dir === "in") {
    //         fromPinId = aPinId;
    //         toPinId = bPinId;
    //     } else if (A.pin.dir === "in" && B.pin.dir === "out") {
    //         // If user clicked in reverse order, flip it
    //         fromPinId = bPinId;
    //         toPinId = aPinId;
    //         finalPoints = [...points].reverse();
    //     } else {
    //         // IN->IN or OUT->OUT not allowed for normal components
    //         return;
    //     }

    //     if (!wireExists(fromPinId, toPinId)) {
    //         next.wires.push({
    //             id: uid(),
    //             fromPinId,
    //             toPinId,
    //             points: finalPoints,
    //         });
    //     }

    //     updateCircuit(next);
    // };


    const connectPins = (aPinId, bPinId, points = []) => {
        // 1️⃣ Prevent self-connection
        if (aPinId === bPinId) return;

        const next = structuredClone(circuit);

        // 2️⃣ Avoid duplicate connections (A↔B or B↔A)
        const exists = next.wires.some(w =>
            (w.fromPinId === aPinId && w.toPinId === bPinId) ||
            (w.fromPinId === bPinId && w.toPinId === aPinId)
        );
        if (exists) return;

        // 3️⃣ Create ONE wire (undirected in simulation)
        next.wires.push({
            id: uid(),
            fromPinId: aPinId,
            toPinId: bPinId,
            points,
        });

        updateCircuit(next);
    };





    const onUpdateWire = (wireId, newPoints, addToHistory = true) => {
        const next = structuredClone(circuit);
        const wire = next.wires.find((w) => w.id === wireId);
        if (wire) {
            wire.points = newPoints;
        }
        if (addToHistory) {
            updateCircuit(next);
        } else {
            // Preview only, don't add to history
            setCircuit(next);
        }
    };

    const onAddJunction = (x, y) => {
        const next = structuredClone(circuit);
        // Create junction centered at x,y
        const junction = makeComponent(KIND.JUNCTION, x - 10, y - 10);
        next.components.push(junction);
        updateCircuit(next);
        return junction;
    };

    const onSplitWire = (wireId, point, split = null) => {
        const next = structuredClone(circuit);
        const wire = next.wires.find((w) => w.id === wireId);
        if (!wire) return null;

        // Create junction centered at the clicked point (junction is 20x20)
        const junction = makeComponent(KIND.JUNCTION, point.x - 10, point.y - 10);
        next.components.push(junction);

        const originalPoints = Array.isArray(wire.points) ? wire.points : [];
        const beforePoints = Array.isArray(split?.beforePoints) ? split.beforePoints : originalPoints;
        const afterPoints = Array.isArray(split?.afterPoints) ? split.afterPoints : [];

        const oldToPinId = wire.toPinId;
        wire.toPinId = junction.pins[0].id;
        wire.points = beforePoints;

        next.wires.push({
            id: uid(),
            fromPinId: junction.pins[1].id,
            toPinId: oldToPinId,
            points: afterPoints,
        });
        updateCircuit(next);
        return junction;
    };

    const onSplitWireAndStartDraft = (wireId, point, split = null) => {
        const next = structuredClone(circuit);
        const wire = next.wires.find((w) => w.id === wireId);
        if (!wire) return;

        // Create junction centered at the clicked point (junction is 20x20)
        const junction = makeComponent(KIND.JUNCTION, point.x - 10, point.y - 10);
        next.components.push(junction);

        const originalPoints = Array.isArray(wire.points) ? wire.points : [];
        const beforePoints = Array.isArray(split?.beforePoints) ? split.beforePoints : originalPoints;
        const afterPoints = Array.isArray(split?.afterPoints) ? split.afterPoints : [];

        const oldToPinId = wire.toPinId;
        wire.toPinId = junction.pins[0].id;
        wire.points = beforePoints;

        next.wires.push({
            id: uid(),
            fromPinId: junction.pins[1].id,
            toPinId: oldToPinId,
            points: afterPoints,
        });
        updateCircuit(next);
        return junction.pins[1].id;
    };

    const onAddJunctionAndConnect = (x, y, fromPinId, points) => {
        const next = structuredClone(circuit);

        // 1. Create Junction
        const junction = makeComponent(KIND.JUNCTION, x - 10, y - 10);
        next.components.push(junction);

        // 2. Find source pin meta to determine direction
        const findPinMeta = (pinId) => {
            for (const c of next.components) {
                const p = c.pins.find((pp) => pp.id === pinId);
                if (p) return { comp: c, pin: p };
            }
            return null;
        }

        const sourceMeta = findPinMeta(fromPinId);
        if (!sourceMeta) return;

        const jIn = junction.pins.find(p => p.name === "IN");
        const jOut = junction.pins.find(p => p.name === "OUT");

        let targetPinId;
        if (sourceMeta.pin.dir === "out") targetPinId = jIn.id;
        else targetPinId = jOut.id;

        // 3. Connect wire
        let wireFrom, wireTo;
        let finalPoints = points;

        if (sourceMeta.pin.dir === "out") {
            wireFrom = fromPinId;
            wireTo = targetPinId;
        } else {
            // Source is IN, so we are connecting FROM the junction TO the source
            // And we must reverse points because points were drawn from Source -> Junction
            wireFrom = targetPinId;
            wireTo = fromPinId;
            finalPoints = [...points].reverse();
        }

        next.wires.push({
            id: uid(),
            fromPinId: wireFrom,
            toPinId: wireTo,
            points: finalPoints,
        });

        updateCircuit(next);
        return junction;
    };

    const onSplitWireAndConnect = (wireId, point, split = null, fromPinId, points) => {
        const next = structuredClone(circuit);
        const wire = next.wires.find((w) => w.id === wireId);
        if (!wire) return null;

        // 1. Create junction and split existing wire
        const junction = makeComponent(KIND.JUNCTION, point.x - 10, point.y - 10);
        next.components.push(junction);

        const originalPoints = Array.isArray(wire.points) ? wire.points : [];
        const beforePoints = Array.isArray(split?.beforePoints) ? split.beforePoints : originalPoints;
        const afterPoints = Array.isArray(split?.afterPoints) ? split.afterPoints : [];

        const oldToPinId = wire.toPinId;
        wire.toPinId = junction.pins[0].id; // Connect original wire to Junction IN
        wire.points = beforePoints;

        next.wires.push({
            id: uid(),
            fromPinId: junction.pins[1].id, // Connect Junction OUT to original destination
            toPinId: oldToPinId,
            points: afterPoints,
        });

        // 2. Connect drafted wire to the new junction
        const findPinMeta = (pinId) => {
            for (const c of next.components) {
                const p = c.pins.find((pp) => pp.id === pinId);
                if (p) return { comp: c, pin: p };
            }
            return null;
        }

        const sourceMeta = findPinMeta(fromPinId);
        if (sourceMeta) {
            const jIn = junction.pins.find(p => p.name === "IN");
            const jOut = junction.pins.find(p => p.name === "OUT");

            let targetPinId;
            // If drafting from OUT pin, connect to Junction IN
            // If drafting from IN pin, connect to Junction OUT
            if (sourceMeta.pin.dir === "out") targetPinId = jIn.id;
            else targetPinId = jOut.id;

            let wireFrom, wireTo;
            let finalPoints = points;

            if (sourceMeta.pin.dir === "out") {
                wireFrom = fromPinId;
                wireTo = targetPinId;
            } else {
                wireFrom = targetPinId;
                wireTo = fromPinId;
                finalPoints = [...points].reverse();
            }

            next.wires.push({
                id: uid(),
                fromPinId: wireFrom,
                toPinId: wireTo,
                points: finalPoints,
            });
        }

        updateCircuit(next);
        return junction;
    };

    const onDragOver = (e) => {
        e.preventDefault();
    };

    const onDrop = (e) => {
        e.preventDefault();
        const kind = e.dataTransfer.getData("text/plain");
        const canvas = e.target.getBoundingClientRect();
        const x = e.clientX - canvas.left;
        const y = e.clientY - canvas.top;
        if (typeof kind === "string" && kind.startsWith("A_")) {
            const def = ANALOG_PART_DEFS[kind];
            const w = def?.size?.w ?? 120;
            const h = def?.size?.h ?? 70;
            addAt(x - w / 2, y - h / 2, kind);
        } else {
            addAt(x - 60, y - 35, kind);
        }
    };

    const handleCreateIC = (data) => {
        if (!icCreationDialog?.selection) return;

        const { name, pins } = data;
        const { selection } = icCreationDialog;

        // 1. Separate pins
        const inputPins = pins
            .filter(p => p.dir === "in")
            .map((p, i) => ({ name: p.name, order: i, internalPinId: p.id }));

        const outputPins = pins
            .filter(p => p.dir === "out")
            .map((p, i) => ({ name: p.name, order: i, internalPinId: p.id }));

        // 2. Extract internal circuit
        // We only save the components that were selected.
        // Wires are tricky: if both ends are selected, it's internal.
        // If one end is outside, it's an interface wire (not part of internal structure usually, but we need to know connectivity).
        // For now, let's just save explicitly selected wires + selected components.
        // A more robust approach (Task 3.1) would be to find all wires strictly internal to the selected components.

        const internalComponents = circuit.components.filter(c => selection.compIds.includes(c.id));

        // Find wires where both ends are in the selection
        const internalWires = circuit.wires.filter(w => {
            const fromComp = circuit.components.find(c => c.pins.some(p => p.id === w.fromPinId));
            const toComp = circuit.components.find(c => c.pins.some(p => p.id === w.toPinId));

            const fromSelected = selection.compIds.includes(fromComp?.id);
            const toSelected = selection.compIds.includes(toComp?.id);

            return fromSelected && toSelected;
        });

        // 3. Create Definition
        const icDef = makeICDefinition(
            name,
            inputPins,
            outputPins,
            { components: internalComponents, wires: internalWires }
        );

        // 4. Save to circuit
        const next = structuredClone(circuit);
        if (!next.icDefinitions) next.icDefinitions = [];
        next.icDefinitions.push(icDef);
        updateCircuit(next);

        setIcCreationDialog(null);
    };

    const deleteIC = (icId, e) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this IC? Existing instances on the canvas will stop working.")) return;

        const next = structuredClone(circuit);
        next.icDefinitions = next.icDefinitions.filter(d => d.id !== icId);
        updateCircuit(next);

        if (selectedKind === `IC_${icId}`) {
            setSelectedKind(KIND.AND);
        }
    };

    return (
        <div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex">
            {/* Left Palette */}
            <div className="w-72 border-r border-neutral-800 bg-neutral-950/60 backdrop-blur flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-neutral-800 sticky top-0 bg-neutral-950/80 backdrop-blur z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-lg font-semibold tracking-tight">Circuit Sim</div>
                            <div className="text-xs text-neutral-400 mt-0.5">Digital logic v1</div>
                        </div>

                        <div className="text-[10px] px-2 py-1 rounded-full border border-neutral-800 text-neutral-300">
                            Drag & drop
                        </div>
                    </div>

                    {/* Search */}
                    <div className="mt-3">
                        <input
                            value={paletteQuery}
                            onChange={(e) => setPaletteQuery(e.target.value)}
                            placeholder="Search components…"
                            className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none
                   placeholder:text-neutral-500 focus:border-yellow-400/60 focus:ring-2 focus:ring-yellow-400/10"
                        />
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 overflow-auto flex-1">
                    {filteredGroups.map((g) => (
                        <div key={g.title} className="mb-5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-semibold text-neutral-300 tracking-wide">
                                    {g.title}
                                </div>
                                <div className="text-[10px] text-neutral-500">
                                    {g.items.length}
                                </div>
                            </div>

                            {/* Grid of cards */}
                            <div className="grid grid-cols-2 gap-2">
                                {g.items.map((p) => {
                                    const active = selectedKind === p.kind;
                                    return (
                                        <div
                                            key={p.kind}
                                            draggable
                                            onDragStart={(e) => e.dataTransfer.setData("text/plain", p.kind)}
                                            onClick={() => setSelectedKind(p.kind)}
                                            className={[
                                                "group relative rounded-xl border px-3 py-2 text-left transition cursor-pointer select-none",
                                                "bg-neutral-900/60 border-neutral-800 hover:bg-neutral-800/70 hover:border-neutral-700",
                                                active
                                                    ? "ring-2 ring-yellow-400/25 border-yellow-400/50 bg-yellow-400 text-black"
                                                    : "",
                                            ].join(" ")}
                                            title="Click to select, or drag onto canvas"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className={["text-sm font-semibold", active ? "text-black" : "text-neutral-100"].join(" ")}>
                                                    {p.label}
                                                </div>
                                                <div
                                                    className={[
                                                        "text-[10px] px-1.5 py-0.5 rounded-md border",
                                                        active
                                                            ? "border-black/15 text-black/80"
                                                            : "border-neutral-700 text-neutral-400 group-hover:text-neutral-300",
                                                    ].join(" ")}
                                                >
                                                    {p.short ?? "ADD"}
                                                </div>
                                            </div>

                                            {p.hint && (
                                                <div className={["mt-1 text-[11px] leading-snug", active ? "text-black/70" : "text-neutral-400"].join(" ")}>
                                                    {p.hint}
                                                </div>
                                            )}

                                            {p.isCustomIC && (
                                                <button
                                                    onClick={(e) => deleteIC(p.icDefId, e)}
                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-red-500/90 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                                                    title="Delete IC"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-xs text-neutral-300 leading-relaxed">
                        <div className="font-semibold text-neutral-200 mb-1">Quick tips</div>
                        <div>• Click a component then click canvas to place</div>
                        <div>• Drag from palette to canvas to place</div>
                        <div>• OUT → IN for valid wiring (others show error)</div>
                        <div className="text-xs opacity-70">
                            Selected: {currentSelection.compIds.length} comps, {currentSelection.wireIds.length} wires
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-neutral-800 sticky bottom-0 bg-neutral-950/80 backdrop-blur space-y-2">
                    <button
                        // onClick={() => setIcCreationDialog({ open: true })}
                        onClick={() => {
                            setIcCreationDialog({
                                open: true,
                                selection: currentSelection, // ✅ PASS SELECTION
                            });
                        }}

                        className="w-full rounded-xl border border-yellow-600/50 bg-yellow-900/20 hover:bg-yellow-900/30 px-3 py-2 text-sm text-yellow-300 font-semibold"
                    >
                        ⚡ Create IC from Selection
                    </button>
                    <button onClick={handleTestAnalog}>Test Analog Netlist</button>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={undo}
                            className="rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-sm text-left"
                        >
                            Undo
                        </button>
                        <button
                            onClick={() => {
                                if (confirm("Clear entire canvas? This cannot be undone.")) {
                                    updateCircuit(makeEmptyCircuit());
                                }
                            }}
                            className="rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-sm text-left"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                const dataStr = JSON.stringify(circuit, null, 2);
                                const blob = new Blob([dataStr], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = `circuit-${Date.now()}.json`;
                                link.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-sm text-left"
                        >
                            Export
                        </button>
                        <button
                            onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = ".json";
                                input.onchange = (e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (e) => {
                                            try {
                                                const loaded = JSON.parse(e.target.result);
                                                updateCircuit(loaded);
                                            } catch (err) {
                                                alert("Failed to load circuit: " + err.message);
                                            }
                                        };
                                        reader.readAsText(file);
                                    }
                                };
                                input.click();
                            }}
                            className="rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-sm text-left"
                        >
                            Import
                        </button>
                    </div>
                </div>
            </div>


            {/* Canvas */}
            <div className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
                {/* <Canvas
                    circuit={simulated}
                    onPlace={addAt}
                    onToggleInput={toggleInput}
                    onConnectPins={connectPins}
                    onMoveComponent={moveComponent}
                    onDeleteComponent={deleteComponent}
                    onDuplicateComponent={duplicateComponent}
                    onDeleteWire={deleteWire}
                    onDeleteMultiple={deleteMultiple}
                    onUpdateWire={onUpdateWire}
                    onSplitWire={onSplitWire}
                    onSplitWireAndStartDraft={onSplitWireAndStartDraft}
                    onToggleClockMode={toggleClockMode}
                    onSetComponentValue={setComponentValue}
                    onSetButtonPressed={setButtonPressed}
                /> */}

                <Canvas
                    circuit={simulated}
                    onPlace={addAt}
                    onAddJunction={onAddJunction}
                    onAddJunctionAndConnect={onAddJunctionAndConnect}
                    onSplitWireAndConnect={onSplitWireAndConnect}
                    onToggleInput={toggleInput}
                    onConnectPins={connectPins}
                    onMoveComponent={moveComponent}
                    onMoveComponents={moveComponents}
                    onDeleteComponent={deleteComponent}
                    onDuplicateComponent={duplicateComponent}
                    onDeleteWire={deleteWire}
                    onDeleteMultiple={deleteMultiple}
                    onUpdateWire={onUpdateWire}
                    onSplitWire={onSplitWire}
                    onSplitWireAndStartDraft={onSplitWireAndStartDraft}
                    onToggleClockMode={toggleClockMode}
                    onSetComponentValue={setComponentValue}
                    onSetButtonPressed={setButtonPressed}
                    onSelectionChange={setCurrentSelection}
                    onOpenProperties={(compId) => setPropertiesSelection({ compIds: [compId], wireIds: [] })}
                />

                <ICCreationDialog
                    isOpen={!!icCreationDialog?.open}
                    onClose={() => setIcCreationDialog(null)}
                    onCreate={handleCreateIC}
                    selection={icCreationDialog?.selection}
                    circuit={circuit}
                />

            </div>

            {/* Right Properties Panel */}
            {propertiesSelection?.compIds?.length === 1 && (
                <PropertiesPanel
                    selection={propertiesSelection}
                    circuit={circuit}
                    updateComponent={handleComponentUpdate}
                    onClose={() => setPropertiesSelection(null)}
                />
            )}
        </div>
    );
}
