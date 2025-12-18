import React, { useState, useEffect } from "react";
import { LV } from "../model/types";

export default function ICCreationDialog({
    isOpen,
    onClose,
    onCreate,
    selection,
    circuit
}) {
    const [icName, setIcName] = useState("");
    const [pins, setPins] = useState([]);
    const [error, setError] = useState(null);

    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            setIcName("");
            setError(null);
            const detected = detectBoundaryPins(selection, circuit);
            setPins(detected);
        }
    }, [isOpen, selection, circuit]);

    if (!isOpen) return null;

    const inputs = pins.filter(p => p.dir === "in");
    const outputs = pins.filter(p => p.dir === "out");
    const unclassified = pins.filter(p => p.dir === "unclassified");

    const handleCreate = () => {
        if (!icName.trim()) {
            setError("IC Name is required");
            return;
        }

        if (unclassified.length > 0) {
            setError(`Please classify all pins. ${unclassified.length} pin(s) need to be marked as Input or Output.`);
            return;
        }

        if (inputs.length === 0 || outputs.length === 0) {
            setError("IC must have at least 1 input and 1 output");
            return;
        }

        // Validate unique names
        const names = new Set();
        for (const p of pins) {
            if (p.dir === "unclassified") continue;
            if (names.has(p.name)) {
                setError(`Duplicate pin name: ${p.name}`);
                return;
            }
            names.add(p.name);
        }

        onCreate({
            name: icName,
            pins: pins.filter(p => p.dir !== "unclassified")
        });
        onClose();
    };

    const updatePinName = (id, newName) => {
        setPins(pins.map(p => p.id === id ? { ...p, name: newName } : p));
    };

    const setPinDirection = (id, dir) => {
        setPins(prevPins => {
            const updated = prevPins.map(p => {
                if (p.id === id) {
                    // Auto-name when direction is set
                    let autoName = p.name;
                    if (p.dir === "unclassified") {
                        // Generate auto-name based on new direction
                        const existingOfType = prevPins.filter(pin => pin.dir === dir);
                        autoName = dir === "in" ? `I${existingOfType.length}` : `O${existingOfType.length}`;
                    }
                    return { ...p, dir, name: autoName };
                }
                return p;
            });
            return updated;
        });
    };

    const autoNamePins = () => {
        setPins(prevPins => {
            let inputCount = 0;
            let outputCount = 0;
            return prevPins.map(p => {
                if (p.dir === "in") {
                    return { ...p, name: `I${inputCount++}` };
                } else if (p.dir === "out") {
                    return { ...p, name: `O${outputCount++}` };
                }
                return p;
            });
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[600px] bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-100">Create Custom IC</h2>
                        <p className="text-xs text-neutral-400 mt-0.5">Define interface pins from selection boundary</p>
                    </div>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white">✕</button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

                    {/* Name Input */}
                    <div>
                        <label className="block text-xs font-semibold text-neutral-400 mb-1 uppercase tracking-wider">
                            IC Name
                        </label>
                        <input
                            type="text"
                            value={icName}
                            onChange={e => setIcName(e.target.value)}
                            onKeyDown={e => e.stopPropagation()}
                            placeholder="e.g. HALF_ADDER"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-yellow-500"
                            autoFocus
                        />
                    </div>

                    {/* Pin Classification Section */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                Interface Pins ({pins.length} detected)
                            </label>
                            {pins.some(p => p.dir !== "unclassified") && (
                                <button
                                    onClick={autoNamePins}
                                    className="text-[10px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                                >
                                    Auto-name (I0, I1, O0...)
                                </button>
                            )}
                        </div>

                        {pins.length === 0 && (
                            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-8 text-center">
                                <div className="text-neutral-500 text-sm">
                                    No boundary pins detected
                                </div>
                                <div className="text-neutral-600 text-xs mt-1">
                                    Select components with wires connecting to external circuits
                                </div>
                            </div>
                        )}

                        {pins.length > 0 && (
                            <div className="bg-neutral-950 border border-neutral-800 rounded-lg divide-y divide-neutral-800">
                                {pins.map((pin) => (
                                    <PinClassificationRow
                                        key={pin.id}
                                        pin={pin}
                                        onSetDirection={setPinDirection}
                                        onUpdateName={updatePinName}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    {pins.length > 0 && (
                        <div className="flex gap-4 text-xs">
                            <div className="flex-1 bg-blue-900/20 border border-blue-900/50 rounded-lg px-3 py-2">
                                <div className="text-blue-400 font-semibold">Inputs</div>
                                <div className="text-blue-300 text-lg font-bold">{inputs.length}</div>
                            </div>
                            <div className="flex-1 bg-green-900/20 border border-green-900/50 rounded-lg px-3 py-2">
                                <div className="text-green-400 font-semibold">Outputs</div>
                                <div className="text-green-300 text-lg font-bold">{outputs.length}</div>
                            </div>
                            <div className="flex-1 bg-amber-900/20 border border-amber-900/50 rounded-lg px-3 py-2">
                                <div className="text-amber-400 font-semibold">Unclassified</div>
                                <div className="text-amber-300 text-lg font-bold">{unclassified.length}</div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-900/20 border border-red-900/50 text-red-400 px-3 py-2 rounded-lg text-sm">
                            ⚠️ {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-neutral-800 flex justify-end gap-2 bg-neutral-950/50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={unclassified.length > 0 || pins.length === 0}
                        className={[
                            "px-4 py-2 rounded-lg text-sm font-semibold transition shadow-lg",
                            unclassified.length > 0 || pins.length === 0
                                ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
                                : "bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-900/20"
                        ].join(" ")}
                    >
                        Create IC
                    </button>
                </div>
            </div>
        </div>
    );
}

// Pin Classification Row Component
function PinClassificationRow({ pin, onSetDirection, onUpdateName }) {
    const isUnclassified = pin.dir === "unclassified";

    return (
        <div className="p-3 hover:bg-neutral-900/50 transition">
            <div className="flex items-center gap-3">
                {/* Direction Toggle */}
                <div className="flex gap-1">
                    <button
                        onClick={() => onSetDirection(pin.id, "in")}
                        className={[
                            "px-3 py-1.5 rounded text-xs font-semibold transition",
                            pin.dir === "in"
                                ? "bg-blue-500 text-white"
                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                        ].join(" ")}
                        title="Mark as Input"
                    >
                        IN
                    </button>
                    <button
                        onClick={() => onSetDirection(pin.id, "out")}
                        className={[
                            "px-3 py-1.5 rounded text-xs font-semibold transition",
                            pin.dir === "out"
                                ? "bg-green-500 text-white"
                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                        ].join(" ")}
                        title="Mark as Output"
                    >
                        OUT
                    </button>
                </div>

                {/* Pin Name Input */}
                <input
                    type="text"
                    value={pin.name}
                    onChange={e => onUpdateName(pin.id, e.target.value)}
                    onKeyDown={e => e.stopPropagation()}
                    disabled={isUnclassified}
                    placeholder={isUnclassified ? "Select direction first" : "Pin name"}
                    className={[
                        "flex-1 bg-neutral-900 border rounded px-3 py-1.5 text-sm outline-none transition",
                        isUnclassified
                            ? "border-neutral-800 text-neutral-600 cursor-not-allowed"
                            : "border-neutral-700 text-neutral-200 focus:border-yellow-500/50"
                    ].join(" ")}
                />

                {/* Source Info */}
                <div className="text-[10px] text-neutral-500 truncate max-w-[150px]" title={pin.sourceInfo}>
                    {pin.sourceInfo}
                </div>

                {/* Status Indicator */}
                {isUnclassified && (
                    <div className="text-[10px] px-2 py-1 rounded-full bg-amber-900/30 text-amber-400 border border-amber-900/50 whitespace-nowrap">
                        Needs classification
                    </div>
                )}
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// Helper: Detect Boundary Pins (Professional - Option 1)
// ----------------------------------------------------------------------
function detectBoundaryPins(selection, circuit) {
    if (!selection || !circuit) return [];

    const { compIds = [] } = selection;
    if (compIds.length === 0) return [];

    const boundaryPins = [];
    const processedPins = new Set();

    // Helper to find component by pin ID
    const findCompByPin = (pinId) => {
        for (const c of circuit.components) {
            const p = c.pins.find(pin => pin.id === pinId);
            if (p) return { comp: c, pin: p };
        }
        return null;
    };

    // Scan all wires to find boundary crossings
    circuit.wires.forEach(wire => {
        const from = findCompByPin(wire.fromPinId);
        const to = findCompByPin(wire.toPinId);

        if (!from || !to) return;

        const fromSelected = compIds.includes(from.comp.id);
        const toSelected = compIds.includes(to.comp.id);

        // Boundary crossing: one end selected, other not
        if (fromSelected && !toSelected) {
            // Wire goes OUT of selection
            if (!processedPins.has(wire.fromPinId)) {
                processedPins.add(wire.fromPinId);
                boundaryPins.push({
                    id: wire.fromPinId,
                    name: from.pin.name || "PIN",
                    dir: "unclassified", // User will classify
                    sourceInfo: `${from.comp.kind} → Outside`,
                    internalPinId: wire.fromPinId // Store for IC creation
                });
            }
        } else if (!fromSelected && toSelected) {
            // Wire comes INTO selection
            if (!processedPins.has(wire.toPinId)) {
                processedPins.add(wire.toPinId);
                boundaryPins.push({
                    id: wire.toPinId,
                    name: to.pin.name || "PIN",
                    dir: "unclassified", // User will classify
                    sourceInfo: `Outside → ${to.comp.kind}`,
                    internalPinId: wire.toPinId // Store for IC creation
                });
            }
        }
    });

    return boundaryPins;
}
