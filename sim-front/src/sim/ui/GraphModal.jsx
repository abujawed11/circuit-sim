import React, { useEffect, useMemo, useState } from "react";
import TransientPlot from "../analog/ui/TransientPlot";

export default function GraphModal({ result, onClose }) {
  const [selectedTraceNames, setSelectedTraceNames] = useState([]);
  const [filterMode, setFilterMode] = useState("all"); // "voltages" | "currents" | "all"

  if (!result) return null;

  const tranData = useMemo(() => {
    if (result?.results?.analysis !== "tran" || !result.results.tran) return null;

    // Preferred backend shape: { x, series: [{name,y}] }
    if (Array.isArray(result.results.tran.series) && Array.isArray(result.results.tran.x)) {
      return { x: result.results.tran.x, series: result.results.tran.series };
    }

    // Back-compat backend shape: { time, series: {name: []} }
    if (Array.isArray(result.results.tran.time) && result.results.tran.series && typeof result.results.tran.series === "object") {
      const series = Object.entries(result.results.tran.series).map(([name, y]) => ({ name, y }));
      return { x: result.results.tran.time, series };
    }

    return null;
  }, [result]);

  const availableTraceNames = useMemo(() => {
    if (!tranData?.series) return [];
    return tranData.series.map((s) => s.name).filter(Boolean);
  }, [tranData]);

  // Separate voltage and current traces
  const { voltageTraces, currentTraces } = useMemo(() => {
    const volts = availableTraceNames.filter((n) => String(n).toLowerCase().startsWith("v("));
    const currents = availableTraceNames.filter((n) => {
      const s = String(n).toLowerCase();
      return s.startsWith("i(") || (s.startsWith("@") && s.endsWith("[i]"));
    });
    return { voltageTraces: volts, currentTraces: currents };
  }, [availableTraceNames]);

  // Filter traces based on mode
  const displayedTraces = useMemo(() => {
    if (filterMode === "voltages") return voltageTraces;
    if (filterMode === "currents") return currentTraces;
    return availableTraceNames; // all
  }, [filterMode, voltageTraces, currentTraces, availableTraceNames]);

  // Auto-select appropriate traces when filter mode changes
  useEffect(() => {
    if (!tranData) return;

    if (filterMode === "voltages") {
      setSelectedTraceNames(voltageTraces.slice(0, 6));
    } else if (filterMode === "currents") {
      setSelectedTraceNames(currentTraces.slice(0, 6));
    } else {
      // All mode - select some voltages and currents
      const next = [...voltageTraces.slice(0, 4), ...currentTraces.slice(0, 2)];
      setSelectedTraceNames(next);
    }
  }, [filterMode, voltageTraces, currentTraces, tranData]);

  const toggleTrace = (name) => {
    setSelectedTraceNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  if (!tranData) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-700 p-8 max-w-md">
          <div className="text-center">
            <div className="text-neutral-400 mb-4 text-lg">No Transient Data</div>
            <div className="text-neutral-500 text-sm mb-6">
              Run a transient analysis to view the graph.
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-700 w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 bg-gradient-to-r from-neutral-900 to-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-2xl font-bold text-white">Transient Analysis Graph</h2>
              <p className="text-sm text-neutral-400 mt-1">Interactive waveform viewer</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors flex items-center justify-center text-xl font-bold"
            >
              ✕
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterMode("voltages")}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                filterMode === "voltages"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              }`}
            >
              Voltages Only
              {voltageTraces.length > 0 && (
                <span className="ml-2 text-xs opacity-75">({voltageTraces.length})</span>
              )}
            </button>
            <button
              onClick={() => setFilterMode("currents")}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                filterMode === "currents"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              }`}
            >
              Currents Only
              {currentTraces.length > 0 && (
                <span className="ml-2 text-xs opacity-75">({currentTraces.length})</span>
              )}
            </button>
            <button
              onClick={() => setFilterMode("all")}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                filterMode === "all"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              }`}
            >
              All Signals
              <span className="ml-2 text-xs opacity-75">({availableTraceNames.length})</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar - Trace Selection */}
          <div className="w-64 border-r border-neutral-800 bg-neutral-950/50 p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-neutral-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              {filterMode === "voltages" ? "Voltage" : filterMode === "currents" ? "Current" : "All"} Traces
            </h3>
            <div className="space-y-2">
              {displayedTraces.map((name) => {
                const isVoltage = String(name).toLowerCase().startsWith("v(");
                const isCurrent = String(name).toLowerCase().startsWith("i(") ||
                                 (String(name).toLowerCase().startsWith("@") && String(name).toLowerCase().endsWith("[i]"));

                return (
                  <label
                    key={name}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                      selectedTraceNames.includes(name)
                        ? "bg-blue-600/20 border border-blue-600/50"
                        : "bg-neutral-800/30 border border-neutral-700/50 hover:bg-neutral-800/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTraceNames.includes(name)}
                      onChange={() => toggleTrace(name)}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-white truncate">{name}</div>
                      <div className="text-[10px] text-neutral-500">
                        {isVoltage ? "Voltage" : isCurrent ? "Current" : "Signal"}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {availableTraceNames.length === 0 && (
              <div className="text-xs text-neutral-500 italic text-center py-4">
                No traces available
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-neutral-800">
              <div className="text-[10px] text-neutral-500 space-y-1">
                <div>• Click trace to toggle</div>
                <div>• Drag graph to zoom</div>
                <div>• Double-click to reset</div>
                <div>• Hover for values</div>
              </div>
            </div>
          </div>

          {/* Main Graph Area */}
          <div className="flex-1 p-6 overflow-auto">
            {selectedTraceNames.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-neutral-500">
                  <div className="text-6xl mb-4">📊</div>
                  <div className="text-lg mb-2">No traces selected</div>
                  <div className="text-sm">Select traces from the sidebar to view the graph</div>
                </div>
              </div>
            ) : filterMode === "all" ? (
              // Split view: Voltages on top, Currents on bottom
              <div className="h-full flex flex-col gap-4">
                {/* Voltage Graph */}
                {voltageTraces.some(v => selectedTraceNames.includes(v)) && (
                  <div className="flex-1 min-h-0">
                    <div className="mb-2 text-sm font-semibold text-blue-400 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Voltages
                    </div>
                    <TransientPlot
                      x={tranData.x}
                      series={tranData.series}
                      selectedNames={selectedTraceNames.filter(n => voltageTraces.includes(n))}
                      yAxisLabel="Voltage (V)"
                    />
                  </div>
                )}

                {/* Current Graph */}
                {currentTraces.some(c => selectedTraceNames.includes(c)) && (
                  <div className="flex-1 min-h-0">
                    <div className="mb-2 text-sm font-semibold text-green-400 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Currents (Auto-Scaled)
                    </div>
                    <TransientPlot
                      x={tranData.x}
                      series={tranData.series}
                      selectedNames={selectedTraceNames.filter(n => currentTraces.includes(n))}
                      autoScaleCurrents={true}
                    />
                  </div>
                )}
              </div>
            ) : (
              // Single graph for voltages or currents only
              <TransientPlot
                x={tranData.x}
                series={tranData.series}
                selectedNames={selectedTraceNames}
                autoScaleCurrents={filterMode === "currents"}
                yAxisLabel={filterMode === "voltages" ? "Voltage (V)" : "Current"}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-between">
          <div className="text-xs text-neutral-500">
            {filterMode === "all" && (
              <span className="mr-3">
                Split View: {voltageTraces.filter(v => selectedTraceNames.includes(v)).length} voltage{voltageTraces.filter(v => selectedTraceNames.includes(v)).length !== 1 ? "s" : ""} • {currentTraces.filter(c => selectedTraceNames.includes(c)).length} current{currentTraces.filter(c => selectedTraceNames.includes(c)).length !== 1 ? "s" : ""}
              </span>
            )}
            {filterMode !== "all" && (
              <span className="mr-3">
                {selectedTraceNames.length} trace{selectedTraceNames.length !== 1 ? "s" : ""} selected
              </span>
            )}
            • {tranData?.x?.length || 0} data points
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
