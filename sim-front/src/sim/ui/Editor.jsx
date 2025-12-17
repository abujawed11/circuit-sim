import React, { useMemo, useState } from "react";
import { KIND, makeEmptyCircuit, LV, uid } from "../model/types";
import { makeComponent } from "../model/gates";
import Canvas from "./Canvas";
import { simulate } from "../engine/simulate";

const palette = [
    { kind: KIND.INPUT, label: "Input" },
    { kind: KIND.LED, label: "LED" },
    { kind: KIND.NOT, label: "NOT" },
    { kind: KIND.AND, label: "AND" },
    { kind: KIND.OR, label: "OR" },
    { kind: KIND.XOR, label: "XOR" },
    { kind: KIND.NAND, label: "NAND" },
    { kind: KIND.NOR, label: "NOR" },
    { kind: KIND.XNOR, label: "XNOR" },
    { kind: KIND.PROBE, label: "Probe" },
    { kind: KIND.CLOCK, label: "Clock" },
    { kind: KIND.SR_LATCH, label: "SR Latch" },
    { kind: KIND.D_FF, label: "D Flip-Flop" },
    { kind: KIND.JK_FF, label: "JK Flip-Flop" },
];

export default function Editor() {
    const [circuit, setCircuit] = useState(() => makeEmptyCircuit());
    const [selectedKind, setSelectedKind] = useState(KIND.AND);
    const [history, setHistory] = useState([makeEmptyCircuit()]);
    const [historyIndex, setHistoryIndex] = useState(0);


    const [paletteQuery, setPaletteQuery] = useState("");

    const groupedPalette = useMemo(() => {
        const groups = [
            {
                title: "I/O",
                items: [
                    { kind: KIND.INPUT, label: "Input", short: "IN", hint: "Toggle 0/1" },
                    { kind: KIND.LED, label: "LED", short: "OUT", hint: "Shows signal" },
                    { kind: KIND.PROBE, label: "Probe", short: "DBG", hint: "0/1/X read" },
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
                ],
            },
            {
                title: "Sequential",
                items: [
                    { kind: KIND.CLOCK, label: "Clock", short: "CLK", hint: "Auto toggle" },
                    { kind: KIND.SR_LATCH, label: "SR Latch", short: "SR" },
                    { kind: KIND.D_FF, label: "D Flip-Flop", short: "DFF" },
                    { kind: KIND.JK_FF, label: "JK Flip-Flop", short: "JK" },
                ],
            },
        ];

        const q = paletteQuery.trim().toLowerCase();
        if (!q) return groups;

        return groups
            .map((g) => ({
                ...g,
                items: g.items.filter((it) => it.label.toLowerCase().includes(q)),
            }))
            .filter((g) => g.items.length > 0);
    }, [paletteQuery]);

    const filteredGroups = groupedPalette;


    const simulated = useMemo(() => {
        const clone = structuredClone(circuit);
        simulate(clone);
        return clone;
    }, [circuit]);

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
        let changed = false;
        const nextComponents = simulated.components.map((c) => {
            let nextState = { ...c.state };
            let hasUpdate = false;

            if (c.state._nextQ !== undefined && c.state._nextQ !== c.state.q) {
                nextState.q = c.state._nextQ;
                delete nextState._nextQ;
                hasUpdate = true;
            }
            if (
                c.state._nextLastClk !== undefined &&
                c.state._nextLastClk !== c.state.lastClk
            ) {
                nextState.lastClk = c.state._nextLastClk;
                delete nextState._nextLastClk;
                hasUpdate = true;
            }

            if (hasUpdate) {
                changed = true;
                return { ...c, state: nextState };
            }
            return c;
        });

        if (changed) {
            setCircuit((prev) => ({ ...prev, components: nextComponents }));
        }
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

    const duplicateComponent = (compId) => {
        const next = structuredClone(circuit);
        const src = next.components.find((c) => c.id === compId);
        if (!src) return;
        const copy = makeComponent(src.kind, src.x + 24, src.y + 24);
        if (src.kind === KIND.INPUT) copy.state.value = src.state.value;
        next.components.push(copy);
        updateCircuit(next);
    };

    const deleteWire = (wireId) => {
        const next = structuredClone(circuit);
        next.wires = next.wires.filter((w) => w.id !== wireId);
        updateCircuit(next);
    };

    const deleteMultiple = (compIds = [], wireIds = []) => {
        const next = structuredClone(circuit);

        // Collect all pin IDs from components to be deleted
        const pinIdsToDelete = new Set();
        compIds.forEach(compId => {
            const comp = next.components.find(c => c.id === compId);
            if (comp) {
                comp.pins.forEach(p => pinIdsToDelete.add(p.id));
            }
        });

        // Delete components
        next.components = next.components.filter(c => !compIds.includes(c.id));

        // Delete wires (both explicitly selected and connected to deleted components)
        next.wires = next.wires.filter(w =>
            !wireIds.includes(w.id) &&
            !pinIdsToDelete.has(w.fromPinId) &&
            !pinIdsToDelete.has(w.toPinId)
        );

        updateCircuit(next);
    };

    const addAt = (x, y, kind) => {
        const next = structuredClone(circuit);
        next.components.push(makeComponent(kind, x, y));
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

    const toggleClockMode = (compId) => {
        const next = structuredClone(circuit);
        const c = next.components.find((cc) => cc.id === compId);
        if (c?.kind === KIND.CLOCK) {
            c.state.mode = c.state.mode === "MANUAL" ? "AUTO" : "MANUAL";
        }
        updateCircuit(next);
    };

    // NEW: connect output pin -> input pin

    const connectPins = (aPinId, bPinId, points = []) => {
        const next = structuredClone(circuit);

        const findPinMeta = (pinId) => {
            for (const c of next.components) {
                const p = c.pins.find((pp) => pp.id === pinId);
                if (p) return { comp: c, pin: p };
            }
            return null;
        };

        const A = findPinMeta(aPinId);
        const B = findPinMeta(bPinId);
        if (!A || !B) return;

        // ✅ Decide correct direction OUT -> IN regardless of click order
        let fromPinId, toPinId;
        let finalPoints = points;

        if (A.pin.dir === "out" && B.pin.dir === "in") {
            fromPinId = aPinId;
            toPinId = bPinId;
            // Pins in correct order, points stay as-is
        } else if (A.pin.dir === "in" && B.pin.dir === "out") {
            fromPinId = bPinId;
            toPinId = aPinId;
            // Pins swapped, reverse points to maintain path
            finalPoints = [...points].reverse();
        } else {
            // IN->IN or OUT->OUT not allowed (prevents blue confusion)
            return;
        }

        // one wire per input (single driver)
        next.wires = next.wires.filter((w) => w.toPinId !== toPinId);

        const exists = next.wires.some(
            (w) => w.fromPinId === fromPinId && w.toPinId === toPinId
        );
        if (!exists) {
            next.wires.push({
                id: uid(),
                fromPinId,
                toPinId,
                points: finalPoints,
            });
        }

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

    const onSplitWire = (wireId, point) => {
        const next = structuredClone(circuit);
        const wire = next.wires.find((w) => w.id === wireId);
        if (!wire) return;

        // Create junction centered at the clicked point (junction is 20x20)
        const junction = makeComponent(KIND.JUNCTION, point.x - 10, point.y - 10);
        next.components.push(junction);

        const oldToPinId = wire.toPinId;
        wire.toPinId = junction.pins[0].id;

        next.wires.push({
            id: uid(),
            fromPinId: junction.pins[1].id,
            toPinId: oldToPinId,
            points: [],
        });
        updateCircuit(next);
    };

    const onSplitWireAndStartDraft = (wireId, point) => {
        const next = structuredClone(circuit);
        const wire = next.wires.find((w) => w.id === wireId);
        if (!wire) return;

        // Create junction centered at the clicked point (junction is 20x20)
        const junction = makeComponent(KIND.JUNCTION, point.x - 10, point.y - 10);
        next.components.push(junction);

        const oldToPinId = wire.toPinId;
        wire.toPinId = junction.pins[0].id;

        next.wires.push({
            id: uid(),
            fromPinId: junction.pins[1].id,
            toPinId: oldToPinId,
            points: [],
        });
        updateCircuit(next);
        return junction.pins[1].id;
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
        addAt(x - 60, y - 35, kind);
    };

    return (
        <div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex">
            {/* Left Palette */}
            {/* <div className="w-64 border-r border-neutral-800 p-4">
                <div className="text-lg font-semibold">Circuit Sim</div>
                <div className="text-xs text-neutral-400 mt-1">Digital logic v1</div>

                <div className="mt-4 space-y-2">
                    {palette.map((p) => (
                        <button
                            key={p.kind}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", p.kind);
                            }}
                            onClick={() => setSelectedKind(p.kind)}
                            className={[
                                "w-full rounded-lg px-3 py-2 text-left border",
                                selectedKind === p.kind
                                    ? "bg-yellow-400 text-black border-yellow-300"
                                    : "bg-neutral-900 border-neutral-800 hover:bg-neutral-800",
                            ].join(" ")}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="mt-6 text-xs text-neutral-400 leading-relaxed">
                    Click canvas to place component. <br />
                    Click OUT pin → click IN pin to wire. <br />
                    Click empty space to cancel wiring.
                </div>
                <div className="mt-auto">
                    <button
                        onClick={undo}
                        className="w-full rounded-lg px-3 py-2 text-left border bg-neutral-900 border-neutral-800 hover:bg-neutral-800"
                    >
                        Undo
                    </button>
                </div>
            </div> */}


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
                                        <button
                                            key={p.kind}
                                            draggable
                                            onDragStart={(e) => e.dataTransfer.setData("text/plain", p.kind)}
                                            onClick={() => setSelectedKind(p.kind)}
                                            className={[
                                                "group rounded-xl border px-3 py-2 text-left transition",
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
                                        </button>
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
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-neutral-800 sticky bottom-0 bg-neutral-950/80 backdrop-blur">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={undo}
                            className="rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-sm text-left"
                        >
                            Undo
                        </button>
                        <button
                            onClick={() => updateCircuit(makeEmptyCircuit())}
                            className="rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-sm text-left"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </div>


            {/* Canvas */}
            <div className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
                <Canvas
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
                />
            </div>
        </div>
    );
}
