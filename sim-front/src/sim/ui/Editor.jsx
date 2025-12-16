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
  const connectPins = (fromPinId, toPinId) => {
    setCircuit((prev) => {
      const next = structuredClone(prev);

      // v1 rule: one wire per input pin (single driver)
      next.wires = next.wires.filter((w) => w.toPinId !== toPinId);

      // also prevent exact duplicates
      const exists = next.wires.some(
        (w) => w.fromPinId === fromPinId && w.toPinId === toPinId
      );
      if (!exists) {
        next.wires.push({ id: uid(), fromPinId, toPinId });
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
          onPlace={addAt}
          onToggleInput={toggleInput}
          onConnectPins={connectPins}
        />
      </div>
    </div>
  );
}
