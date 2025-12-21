import React, { useMemo, useRef, useState } from "react";
import TransientPlot from "../analog/ui/TransientPlot";

export default function GraphModal({ result, onClose }) {
  const [selectedTraceNames, setSelectedTraceNames] = useState(null); // null = use defaults
  const [filterMode, setFilterMode] = useState("all"); // "voltages" | "currents" | "all"
  const [pos, setPos] = useState({ x: 24, y: 80 });

  const panelRef = useRef(null);
  const dragRef = useRef(null);

  const tranData = useMemo(() => {
    if (result?.results?.analysis !== "tran" || !result.results.tran) return null;
    const tran = result.results.tran;

    // Preferred backend shape: { x, series: [{name,y}] }
    if (Array.isArray(tran.series) && Array.isArray(tran.x)) {
      return { x: tran.x, series: tran.series };
    }

    // Back-compat backend shape: { time, series: {name: []} }
    if (Array.isArray(tran.time) && tran.series && typeof tran.series === "object") {
      const series = Object.entries(tran.series).map(([name, y]) => ({ name, y }));
      return { x: tran.time, series };
    }

    // Back-compat fallback: { time, seriesMap: {name: []} }
    if (Array.isArray(tran.time) && tran.seriesMap && typeof tran.seriesMap === "object") {
      const series = Object.entries(tran.seriesMap).map(([name, y]) => ({ name, y }));
      return { x: tran.time, series };
    }

    return null;
  }, [result]);

  const availableTraceNames = useMemo(() => {
    if (!tranData?.series) return [];
    return tranData.series.map((s) => s.name).filter(Boolean);
  }, [tranData]);

  const { voltageTraces, currentTraces } = useMemo(() => {
    const volts = availableTraceNames.filter((n) => String(n).toLowerCase().startsWith("v("));
    const currents = availableTraceNames.filter((n) => {
      const s = String(n).toLowerCase();
      // Match i(device) or @device[i] formats
      return s.startsWith("i(") || (s.startsWith("@") && s.endsWith("[i]"));
    });
    return { voltageTraces: volts, currentTraces: currents };
  }, [availableTraceNames]);

  const displayedTraces = useMemo(() => {
    if (filterMode === "voltages") return voltageTraces;
    if (filterMode === "currents") return currentTraces;
    return availableTraceNames;
  }, [availableTraceNames, currentTraces, filterMode, voltageTraces]);

  const defaultSelectedTraceNames = useMemo(() => {
    if (!tranData) return [];
    if (filterMode === "voltages") return voltageTraces.slice(0, 6);
    if (filterMode === "currents") return currentTraces.slice(0, 6);
    return [...voltageTraces.slice(0, 4), ...currentTraces.slice(0, 2)];
  }, [currentTraces, filterMode, tranData, voltageTraces]);

  const effectiveSelectedTraceNames = selectedTraceNames ?? defaultSelectedTraceNames;

  const toggleTrace = (name) => {
    setSelectedTraceNames((prev) => {
      const base = prev ?? defaultSelectedTraceNames;
      return base.includes(name) ? base.filter((n) => n !== name) : [...base, name];
    });
  };

  const clampToViewport = (next) => {
    if (typeof window === "undefined") return next;
    const pad = 8;
    const rect = panelRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 900;
    const h = rect?.height ?? 600;
    const maxX = Math.max(pad, window.innerWidth - pad - w);
    const maxY = Math.max(pad, window.innerHeight - pad - h);
    return {
      x: Math.max(pad, Math.min(maxX, next.x)),
      y: Math.max(pad, Math.min(maxY, next.y)),
    };
  };

  const onHeaderPointerDown = (e) => {
    if (e.button !== 0) return;
    // Don't start drag when interacting with controls inside the header (tabs, buttons, etc.).
    if (e.target?.closest?.("button, input, select, textarea, a, label")) return;

    setPos((p) => clampToViewport(p));
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      started: false,
    };
    try {
      // Only capture once we actually start dragging (see move handler).
    } catch {
      // ignore
    }
  };

  const onHeaderPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.started) {
      // Small deadzone so clicks on the header still work reliably.
      if (Math.abs(dx) + Math.abs(dy) < 3) return;
      d.started = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    setPos(clampToViewport({ x: d.originX + dx, y: d.originY + dy }));
  };

  const onHeaderPointerUp = (e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      if (d.started) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Floating draggable window (no full-screen overlay)
  if (!tranData) {
    return (
      <div
        ref={panelRef}
        className="fixed z-[60] bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-700 w-[min(720px,calc(100vw-16px))] max-h-[80vh] flex flex-col overflow-hidden"
        style={{ left: pos.x, top: pos.y }}
      >
        <div
          className="px-4 py-3 border-b border-neutral-800 bg-gradient-to-r from-neutral-900 to-neutral-800 cursor-move select-none touch-none flex items-center justify-between"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
        >
          <div className="font-semibold text-neutral-200">Transient Graph</div>
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-9 h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors flex items-center justify-center text-sm font-bold"
            title="Close"
            aria-label="Close graph"
          >
            X
          </button>
        </div>
        <div className="p-4 overflow-auto">
          <div className="text-neutral-300 mb-2 text-sm">No Transient Data</div>
          <div className="text-neutral-500 text-xs">Run a transient analysis to view the graph.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-[60] bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-700 w-[min(1200px,calc(100vw-16px))] h-[min(780px,calc(100vh-16px))] flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="px-6 py-4 border-b border-neutral-800 bg-gradient-to-r from-neutral-900 to-neutral-800">
        <div
          className="flex items-center justify-between mb-3 cursor-move select-none touch-none"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
        >
          <div>
            <h2 className="text-2xl font-bold text-white">Transient Analysis Graph</h2>
            <p className="text-sm text-neutral-400 mt-1">Interactive waveform viewer</p>
          </div>
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-10 h-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors flex items-center justify-center text-sm font-bold"
            title="Close"
            aria-label="Close graph"
          >
            X
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setFilterMode("voltages");
              setSelectedTraceNames(null);
            }}
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
            onClick={() => {
              setFilterMode("currents");
              setSelectedTraceNames(null);
            }}
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
            onClick={() => {
              setFilterMode("all");
              setSelectedTraceNames(null);
            }}
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

      <div className="flex-1 overflow-hidden flex">
        <div className="w-64 border-r border-neutral-800 bg-neutral-950/50 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            {filterMode === "voltages"
              ? "Voltage"
              : filterMode === "currents"
                ? "Current"
                : "All"}{" "}
            Traces
          </h3>
          <div className="space-y-2">
            {displayedTraces.map((name) => {
              const lower = String(name).toLowerCase();
              const isVoltage = lower.startsWith("v(");
              const isCurrent = lower.startsWith("i(") || (lower.startsWith("@") && lower.endsWith("[i]"));

              return (
                <label
                  key={name}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                    effectiveSelectedTraceNames.includes(name)
                      ? "bg-blue-600/20 border border-blue-600/50"
                      : "bg-neutral-800/30 border border-neutral-700/50 hover:bg-neutral-800/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={effectiveSelectedTraceNames.includes(name)}
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
            <div className="text-xs text-neutral-500 italic text-center py-4">No traces available</div>
          )}

          <div className="mt-6 pt-4 border-t border-neutral-800">
            <div className="text-[10px] text-neutral-500 space-y-1">
              <div>Tip: Click trace to toggle</div>
              <div>Tip: Drag graph to zoom</div>
              <div>Tip: Double-click to reset</div>
              <div>Tip: Hover for values</div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-auto">
          {effectiveSelectedTraceNames.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-neutral-500">
                <div className="text-lg mb-2">No traces selected</div>
                <div className="text-sm">Select traces from the sidebar to view the graph</div>
              </div>
            </div>
          ) : filterMode === "all" ? (
            <div className="h-full flex flex-col gap-4">
              {voltageTraces.some((v) => effectiveSelectedTraceNames.includes(v)) && (
                <div className="flex-1 min-h-0">
                  <div className="mb-2 text-sm font-semibold text-blue-400 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                    Voltages
                  </div>
                  <TransientPlot
                    x={tranData.x}
                    series={tranData.series}
                    selectedNames={effectiveSelectedTraceNames.filter((n) => voltageTraces.includes(n))}
                    yAxisLabel="Voltage (V)"
                  />
                </div>
              )}

              {currentTraces.some((c) => effectiveSelectedTraceNames.includes(c)) && (
                <div className="flex-1 min-h-0">
                  <div className="mb-2 text-sm font-semibold text-green-400 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Currents
                  </div>
                  <TransientPlot
                    x={tranData.x}
                    series={tranData.series}
                    selectedNames={effectiveSelectedTraceNames.filter((n) => currentTraces.includes(n))}
                    autoScaleCurrents={true}
                  />
                </div>
              )}
            </div>
          ) : (
            <TransientPlot
              x={tranData.x}
              series={tranData.series}
              selectedNames={effectiveSelectedTraceNames}
              autoScaleCurrents={filterMode === "currents"}
              yAxisLabel={filterMode === "voltages" ? "Voltage (V)" : "Current"}
            />
          )}
        </div>
      </div>

      <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-between">
        <div className="text-xs text-neutral-500">
          {filterMode === "all" ? (
            <>
              Split View:{" "}
              {voltageTraces.filter((v) => effectiveSelectedTraceNames.includes(v)).length} voltage
              {voltageTraces.filter((v) => effectiveSelectedTraceNames.includes(v)).length !== 1 ? "s" : ""}{" "}
              | {currentTraces.filter((c) => effectiveSelectedTraceNames.includes(c)).length} current
              {currentTraces.filter((c) => effectiveSelectedTraceNames.includes(c)).length !== 1 ? "s" : ""}{" "}
              | {tranData?.x?.length || 0} points
            </>
          ) : (
            <>
              {effectiveSelectedTraceNames.length} trace{effectiveSelectedTraceNames.length !== 1 ? "s" : ""} selected |{" "}
              {tranData?.x?.length || 0} points
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}
