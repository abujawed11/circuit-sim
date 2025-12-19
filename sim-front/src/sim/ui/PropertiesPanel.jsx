import React from "react";
import { KIND } from "../model/types";

export default function PropertiesPanel({ selection, circuit, updateComponent }) {
  if (selection.compIds.length !== 1) {
    return (
      <div className="w-64 border-l border-neutral-800 bg-neutral-950/60 p-4 text-neutral-500 text-sm">
        Select a single component to edit properties.
      </div>
    );
  }

  const compId = selection.compIds[0];
  const comp = circuit.components.find((c) => c.id === compId);

  if (!comp) return null;

  const handleChange = (field, value, isState = false) => {
    // If isState is true, we update comp.state[field]
    // Else we update comp.props[field] (if props doesn't exist, create it)
    
    // Create a copy of the component to update
    const nextComp = structuredClone(comp);
    
    if (isState) {
        if (!nextComp.state) nextComp.state = {};
        nextComp.state[field] = value;
    } else {
        if (!nextComp.props) nextComp.props = {};
        nextComp.props[field] = value;
    }

    updateComponent(nextComp);
  };

  return (
    <div className="w-64 border-l border-neutral-800 bg-neutral-950/60 backdrop-blur flex flex-col h-full">
      <div className="p-4 border-b border-neutral-800 font-semibold text-neutral-200">
        Properties
      </div>
      
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Common Info */}
        <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-500 uppercase">Type</label>
            <div className="text-sm text-neutral-300 bg-neutral-900 px-2 py-1.5 rounded border border-neutral-800">
                {comp.kind}
            </div>
        </div>

        {/* CLOCK Specifics */}
        {comp.kind === KIND.CLOCK && (
            <>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-500 uppercase">Interval (ms)</label>
                    <input
                        type="number"
                        min="10"
                        step="10"
                        value={comp.state?.interval ?? 1000}
                        onChange={(e) => handleChange("interval", parseInt(e.target.value) || 100, true)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-500 uppercase">Frequency (Hz)</label>
                    <div className="text-xs text-neutral-400 mb-1">Approximate</div>
                    <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={comp.state?.interval ? (1000 / comp.state.interval).toFixed(1) : "1.0"}
                        onChange={(e) => {
                            const hz = parseFloat(e.target.value) || 1;
                            const ms = Math.round(1000 / hz);
                            handleChange("interval", ms, true);
                        }}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
                    />
                </div>
            </>
        )}
        
        {/* BUFFER / DELAY Specifics */}
        {comp.kind === KIND.BUFFER && (
            <>
             <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500 uppercase">Delay (Ticks)</label>
                <input
                    type="number"
                    min="1"
                    max="100"
                    value={comp.props?.delay ?? 2}
                    onChange={(e) => handleChange("delay", parseInt(e.target.value) || 1, false)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
                />
            </div>
            <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500 uppercase">Delay (ms)</label>
                <div className="text-xs text-neutral-400 mb-1">1 tick = 50ms</div>
                <input
                    type="number"
                    min="50"
                    step="50"
                    value={(comp.props?.delay ?? 2) * 50}
                    onChange={(e) => {
                        const ms = parseInt(e.target.value) || 50;
                        const ticks = Math.max(1, Math.round(ms / 50));
                        handleChange("delay", ticks, false);
                    }}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
                />
            </div>
            </>
        )}

        {/* 555 TIMER Specifics */}
        {comp.kind === KIND.TIMER_555 && (
             <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-500 uppercase">Pulse Width (ms)</label>
                <input
                    type="number"
                    min="50"
                    step="50"
                    value={comp.props?.pulseMs ?? 800}
                    onChange={(e) => handleChange("pulseMs", parseInt(e.target.value) || 100, false)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-yellow-500/50"
                />
            </div>
        )}

      </div>
    </div>
  );
}
