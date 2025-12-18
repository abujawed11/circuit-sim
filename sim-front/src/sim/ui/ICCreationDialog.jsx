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
            const detected = detectInterfacePins(selection, circuit);
            setPins(detected);
        }
    }, [isOpen, selection, circuit]);

    if (!isOpen) return null;

    const inputs = pins.filter(p => p.dir === "in");
    const outputs = pins.filter(p => p.dir === "out");

    const handleCreate = () => {
        if (!icName.trim()) {
            setError("IC Name is required");
            return;
        }
        if (pins.length === 0) {
            setError("No interface pins detected. Select components connected to the outside.");
            return;
        }

        // Validate unique names
        const names = new Set();
        for (const p of pins) {
            if (names.has(p.name)) {
                setError(`Duplicate pin name: ${p.name}`);
                return;
            }
            names.add(p.name);
        }

        onCreate({
            name: icName,
            pins: pins
        });
        onClose();
    };

    const updatePinName = (id, newName) => {
        setPins(pins.map(p => p.id === id ? { ...p, name: newName } : p));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-125 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-neutral-100">Create New IC</h2>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white">✕</button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    
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

                    {/* Inputs Section */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                Input Pins ({inputs.length})
                            </label>
                            <span className="text-[10px] text-neutral-600">Detected from selection</span>
                        </div>
                        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2 space-y-1">
                            {inputs.length === 0 && (
                                <div className="text-xs text-neutral-600 italic p-2 text-center">No inputs detected</div>
                            )}
                            {inputs.map((pin, i) => (
                                <div key={pin.id} className="flex items-center gap-2">
                                    <div className="w-6 text-center text-xs text-neutral-600 font-mono">{i}</div>
                                    <input
                                        type="text"
                                        value={pin.name}
                                        onChange={e => updatePinName(pin.id, e.target.value)}
                                        onKeyDown={e => e.stopPropagation()}
                                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm text-neutral-300 focus:border-yellow-500/50 outline-none"
                                    />
                                    <div className="text-[10px] text-neutral-600 truncate max-w-25" title={pin.sourceInfo}>
                                        {pin.sourceInfo}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Outputs Section */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                Output Pins ({outputs.length})
                            </label>
                            <span className="text-[10px] text-neutral-600">Detected from selection</span>
                        </div>
                        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2 space-y-1">
                            {outputs.length === 0 && (
                                <div className="text-xs text-neutral-600 italic p-2 text-center">No outputs detected</div>
                            )}
                            {outputs.map((pin, i) => (
                                <div key={pin.id} className="flex items-center gap-2">
                                    <div className="w-6 text-center text-xs text-neutral-600 font-mono">{i}</div>
                                    <input
                                        type="text"
                                        value={pin.name}
                                        onChange={e => updatePinName(pin.id, e.target.value)}
                                        onKeyDown={e => e.stopPropagation()}
                                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm text-neutral-300 focus:border-yellow-500/50 outline-none"
                                    />
                                    <div className="text-[10px] text-neutral-600 truncate max-w-25" title={pin.sourceInfo}>
                                        {pin.sourceInfo}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

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
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-yellow-500 text-black hover:bg-yellow-400 transition shadow-lg shadow-yellow-900/20"
                    >
                        Create IC
                    </button>
                </div>
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// Helper: Detect Interface Pins (Task 2.1 - Enhanced)
// ----------------------------------------------------------------------
function detectInterfacePins(selection, circuit) {
    if (!selection || !circuit) return [];
    
    const { compIds = [], wireIds = [] } = selection;
    const interfacePins = [];
    const processedPins = new Set();
    const processedCompIds = new Set(); // Track components used as pins

    // Helper to find component by pin ID
    const findCompByPin = (pinId) => {
        for (const c of circuit.components) {
            const p = c.pins.find(pin => pin.id === pinId);
            if (p) return { comp: c, pin: p };
        }
        return null;
    };

    // 1. Detect Boundary Wires (Original Logic)
    circuit.wires.forEach(wire => {
        const from = findCompByPin(wire.fromPinId);
        const to = findCompByPin(wire.toPinId);

        if (!from || !to) return;

        const fromSelected = compIds.includes(from.comp.id);
        const toSelected = compIds.includes(to.comp.id);

        // Case 1: Output Pin (Inside -> Outside)
        if (fromSelected && !toSelected) {
            // Ignore if the source component is being treated as a pin itself (handled in step 2)
            // But actually, we want to capture it here if it's a boundary.
            
            if (!processedPins.has(wire.fromPinId)) {
                processedPins.add(wire.fromPinId);
                interfacePins.push({
                    id: wire.fromPinId,
                    name: from.pin.name || "OUT",
                    dir: "out",
                    sourceInfo: `From ${from.comp.kind}`,
                    // relatedCompId: from.comp.id // Optional: link to internal comp
                });
            }
        }

        // Case 2: Input Pin (Outside -> Inside)
        if (!fromSelected && toSelected) {
            if (!processedPins.has(wire.toPinId)) {
                processedPins.add(wire.toPinId);
                interfacePins.push({
                    id: wire.toPinId,
                    name: to.pin.name || "IN",
                    dir: "in",
                    sourceInfo: `To ${to.comp.kind}`,
                });
            }
        }
    });

    // 2. Detect Explicit IO Components (New Logic)
    // If user selected an INPUT/BUTTON/LED, treat it as a pin definition
    compIds.forEach(compId => {
        const comp = circuit.components.find(c => c.id === compId);
        if (!comp) return;

        // Input Components -> Input Pins
        if (comp.kind === "INPUT" || comp.kind === "BUTTON") {
            const outPin = comp.pins.find(p => p.dir === "out");
            if (outPin && !processedCompIds.has(compId)) {
                processedCompIds.add(compId);
                
                // Only add if not already captured by boundary logic (avoid duplicates)
                // Actually, if we selected the Input, the boundary logic above (Inside->Outside)
                // might have caught the wire going from this Input to another Selected Gate?
                // No, if both are selected, it's considered Internal.
                // So we MUST add it here.
                
                // Check if this pin ID was already added? 
                // The pin ID of the INPUT component is what we want to expose?
                // Or do we create a logical mapping? 
                // For now, let's use the Component ID as the reference for the "Pin" 
                // but the UI needs a pin ID. Let's use the component's output pin ID.
                
                if (!processedPins.has(outPin.id)) {
                    processedPins.add(outPin.id);
                    interfacePins.push({
                        id: outPin.id,
                        name: comp.label || "IN", // Use label if available (though currently components don't have user labels, use default)
                        dir: "in",
                        sourceInfo: `From ${comp.kind} (Selected)`,
                        isExplicit: true // Flag to indicate this came from a selected component
                    });
                }
            }
        }

        // Output Components -> Output Pins
        if (comp.kind === "LED" || comp.kind === "PROBE") {
            const inPin = comp.pins.find(p => p.dir === "in");
            if (inPin && !processedCompIds.has(compId)) {
                processedCompIds.add(compId);
                
                if (!processedPins.has(inPin.id)) {
                    processedPins.add(inPin.id);
                    interfacePins.push({
                        id: inPin.id,
                        name: "OUT", 
                        dir: "out",
                        sourceInfo: `To ${comp.kind} (Selected)`,
                        isExplicit: true
                    });
                }
            }
        }
    });
    
    // Auto-name pins if they are generic (e.g. IN, OUT) to avoid duplicates
    const nameCounts = {};
    interfacePins.forEach(p => {
        const base = p.name;
        if (!nameCounts[base]) nameCounts[base] = 0;
        nameCounts[base]++;
    });

    // Second pass to resolve duplicates
    const finalCounts = {};
    interfacePins.forEach(p => {
        const base = p.name;
        if (nameCounts[base] > 1) {
            if (!finalCounts[base]) finalCounts[base] = 0;
            finalCounts[base]++;
            p.name = `${base}_${finalCounts[base]}`; // e.g. IN_1, IN_2
        }
    });

    // Sort: Inputs first, then Outputs
    return interfacePins.sort((a, b) => {
        if (a.dir === b.dir) return 0;
        return a.dir === "in" ? -1 : 1;
    });
}
