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
  const [history, setHistory] = useState([makeEmptyCircuit()]);
  const [historyIndex, setHistoryIndex] = useState(0);

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

  const simulated = useMemo(() => {
    const clone = structuredClone(circuit);
    simulate(clone);
    return clone;
  }, [circuit]);

  const moveComponent = (compId, x, y) => {
    const next = structuredClone(circuit);
    const c = next.components.find((cc) => cc.id === compId);
    if (c) {
      c.x = x;
      c.y = y;
    }
    updateCircuit(next);
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

  // NEW: connect output pin -> input pin
  const connectPins = (fromPinId, toPinId, points = []) => {
    const next = structuredClone(circuit);
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
    updateCircuit(next);
  };

  const onUpdateWire = (wireId, newPoints) => {
    const next = structuredClone(circuit);
    const wire = next.wires.find((w) => w.id === wireId);
    if (wire) {
      wire.points = newPoints;
    }
    updateCircuit(next);
  };

  const onSplitWire = (wireId, point) => {
    const next = structuredClone(circuit);
    const wire = next.wires.find((w) => w.id === wireId);
    if (!wire) return;

    const junction = makeComponent(KIND.JUNCTION, point.x, point.y);
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

    const junction = makeComponent(KIND.JUNCTION, point.x, point.y);
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
      <div className="w-64 border-r border-neutral-800 p-4">
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
          onUpdateWire={onUpdateWire}
          onSplitWire={onSplitWire}
          onSplitWireAndStartDraft={onSplitWireAndStartDraft}
        />
      </div>
    </div>
  );
}
