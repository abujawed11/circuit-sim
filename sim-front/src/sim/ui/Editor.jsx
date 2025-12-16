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
];

export default function Editor() {
    const [circuit, setCircuit] = useState(() => makeEmptyCircuit());
    const [selectedKind, setSelectedKind] = useState(KIND.AND);

    const simulated = useMemo(() => {
        const clone = structuredClone(circuit);
        simulate(clone);
        return clone;
    }, [circuit]);

    const moveComponent = (compId, x, y) => {
        setCircuit((prev) => {
            const next = structuredClone(prev);
            const c = next.components.find((cc) => cc.id === compId);
            if (c) {
                c.x = x;
                c.y = y;
            }
            return next;
        });
    };



    React.useEffect(() => {
        const handler = (e) => {
            const { compId } = e.detail;
            setCircuit((prev) => {
                const next = structuredClone(prev);
                const comp = next.components.find((c) => c.id === compId);
                if (!comp) return prev;

                const pinIds = new Set(comp.pins.map((p) => p.id));

                // remove component
                next.components = next.components.filter((c) => c.id !== compId);

                // remove wires connected to its pins
                next.wires = next.wires.filter(
                    (w) => !pinIds.has(w.fromPinId) && !pinIds.has(w.toPinId)
                );

                return next;
            });
        };

        window.addEventListener("sim:deleteComponent", handler);
        return () => window.removeEventListener("sim:deleteComponent", handler);
    }, []);



    const snap = (n) => Math.round(n / 24) * 24;

    // const moveComponent = (compId, x, y) => {
    //     setCircuit((prev) => {
    //         const next = structuredClone(prev);
    //         const c = next.components.find((cc) => cc.id === compId);
    //         if (c) {
    //             c.x = snap(x);
    //             c.y = snap(y);
    //         }
    //         return next;
    //     });
    // };

    const deleteComponent = (compId) => {
        setCircuit((prev) => {
            const next = structuredClone(prev);
            const comp = next.components.find((c) => c.id === compId);
            if (!comp) return prev;

            const pinIds = new Set(comp.pins.map((p) => p.id));
            next.components = next.components.filter((c) => c.id !== compId);
            next.wires = next.wires.filter(
                (w) => !pinIds.has(w.fromPinId) && !pinIds.has(w.toPinId)
            );
            return next;
        });
    };

    const duplicateComponent = (compId) => {
        setCircuit((prev) => {
            const next = structuredClone(prev);
            const src = next.components.find((c) => c.id === compId);
            if (!src) return prev;

            // recreate a fresh component with new ids (pins must be new)
            const copy = makeComponent(src.kind, src.x + 24, src.y + 24);

            // preserve INPUT value
            if (src.kind === KIND.INPUT) copy.state.value = src.state.value;

            next.components.push(copy);
            return next;
        });
    };

    const deleteWire = (wireId) => {
        setCircuit((prev) => ({
            ...prev,
            wires: prev.wires.filter((w) => w.id !== wireId),
        }));
    };



    const addAt = (x, y) => {
        setCircuit((prev) => ({
            ...prev,
            components: [...prev.components, makeComponent(selectedKind, x, y)],
        }));
    };

    const toggleInput = (compId) => {
        setCircuit((prev) => {
            const next = structuredClone(prev);
            const c = next.components.find((cc) => cc.id === compId);
            if (c?.kind === KIND.INPUT) {
                c.state.value = c.state.value === LV.HIGH ? LV.LOW : LV.HIGH;
            }
            return next;
        });
    };

    // NEW: connect output pin -> input pin
    const connectPins = (fromPinId, toPinId, points = []) => {
        setCircuit((prev) => {
            const next = structuredClone(prev);

            // v1 rule: one wire per input pin (single driver)
            next.wires = next.wires.filter((w) => w.toPinId !== toPinId);

            const exists = next.wires.some(
                (w) => w.fromPinId === fromPinId && w.toPinId === toPinId
            );
            if (!exists) {
                next.wires.push({
                    id: uid(),
                    fromPinId,
                    toPinId,
                    points, // ✅ store route points
                });
            }
            return next;
        });
    };


    return (
        <div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex">
            {/* Left Palette */}
            <div className="w-64 border-r border-neutral-800 p-4">
                <div className="text-lg font-semibold">Circuit Sim</div>
                <div className="text-xs text-neutral-400 mt-1">Digital logic v1</div>

                <div className="mt-4 space-y-2">
                    {palette.map((p) => (
                        <button
                            key={p.kind}
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
            </div>

            {/* Canvas */}
            <div className="flex-1">
                <Canvas
                    circuit={simulated}
                    onPlace={(x, y) => addAt(snap(x), snap(y))}
                    onToggleInput={toggleInput}
                    onConnectPins={connectPins}
                    onMoveComponent={moveComponent}
                    onDeleteComponent={deleteComponent}
                    onDuplicateComponent={duplicateComponent}
                    onDeleteWire={deleteWire}
                />

            </div>
        </div>
    );
}
