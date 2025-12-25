import React, { useEffect, useRef, useState } from "react";

/**
 * Live Waveform Graph - EveryCircuit style
 * Shows real-time waveform as simulation plays
 */
export default function LiveWaveformGraph({
    tranData,
    currentTime,
    selectedSignals = [],
    onClose,
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Signal selection state
    const [enabledSignals, setEnabledSignals] = useState(new Set());
    const [signalFilter, setSignalFilter] = useState("all"); // "all", "voltage", "current"

    // Initialize enabled signals on mount
    useEffect(() => {
        if (!tranData?.series) return;

        // Auto-enable first 3 voltage signals by default
        const voltages = tranData.series
            .filter(s => s.name.toLowerCase().startsWith("v("))
            .slice(0, 3)
            .map(s => s.name);

        setEnabledSignals(new Set(voltages));
    }, [tranData]);

    useEffect(() => {
        if (!tranData || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const container = containerRef.current;

        // Set canvas size
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        // Clear
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        drawGrid(ctx, width, height);

        // Get time array
        const timeArray = tranData.x || tranData.time || [];
        if (timeArray.length === 0) return;

        const maxTime = timeArray[timeArray.length - 1];
        const minTime = timeArray[0];

        // Filter signals based on enabled set
        let signals = (tranData.series || []).filter(s => enabledSignals.has(s.name));

        // Apply type filter
        if (signalFilter === "voltage") {
            signals = signals.filter(s => s.name.toLowerCase().startsWith("v("));
        } else if (signalFilter === "current") {
            signals = signals.filter(s => s.name.toLowerCase().startsWith("i(") || s.name.toLowerCase().includes("[i]"));
        }

        // Draw waveforms
        const colors = [
            "#FFD700", // Gold
            "#00BFFF", // Deep Sky Blue
            "#FF69B4", // Hot Pink
            "#7FFF00", // Chartreuse
            "#FF6347", // Tomato
            "#9370DB", // Medium Purple
        ];

        signals.forEach((signal, idx) => {
            const color = colors[idx % colors.length];
            const type = signal.name.toLowerCase().startsWith("v(") ? "voltage" : "current";
            drawWaveform(ctx, signal, timeArray, width, height, color, type, maxTime, minTime, currentTime);
        });

        // Draw current time indicator
        if (currentTime !== undefined) {
            const x = ((currentTime - minTime) / (maxTime - minTime)) * (width - 80) + 60;
            ctx.strokeStyle = "#FF0000";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x, 20);
            ctx.lineTo(x, height - 30);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw legend
        drawLegend(ctx, signals, colors, width, height);

    }, [tranData, currentTime, enabledSignals, signalFilter]);

    const drawGrid = (ctx, width, height) => {
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 1;

        // Vertical grid lines
        for (let x = 60; x < width - 20; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 20);
            ctx.lineTo(x, height - 30);
            ctx.stroke();
        }

        // Horizontal grid lines
        for (let y = 20; y < height - 30; y += 40) {
            ctx.beginPath();
            ctx.moveTo(60, y);
            ctx.lineTo(width - 20, y);
            ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(60, height - 30);
        ctx.lineTo(width - 20, height - 30);
        ctx.moveTo(60, 20);
        ctx.lineTo(60, height - 30);
        ctx.stroke();
    };

    const drawWaveform = (ctx, signal, timeArray, width, height, color, type, maxTime, minTime, currentTime) => {
        const values = signal.y || [];
        if (values.length === 0) return;

        // Auto-scale based on signal type
        let maxValue = Math.max(...values);
        let minValue = Math.min(...values);

        // Add 10% padding
        const padding = (maxValue - minValue) * 0.1;
        maxValue += padding;
        minValue -= padding;

        if (Math.abs(maxValue - minValue) < 1e-12) {
            maxValue = minValue + 1;
        }

        const plotHeight = height - 50;
        const plotWidth = width - 80;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        let firstPoint = true;
        for (let i = 0; i < values.length; i++) {
            const t = timeArray[i];
            const v = values[i];

            // Skip points beyond current time for "sweeping" effect
            if (currentTime !== undefined && t > currentTime) {
                break;
            }

            const x = 60 + ((t - minTime) / (maxTime - minTime)) * plotWidth;
            const y = 20 + plotHeight - ((v - minValue) / (maxValue - minValue)) * plotHeight;

            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        // Draw signal name
        ctx.fillStyle = color;
        ctx.font = "10px monospace";
        ctx.fillText(signal.name, 65, 35);
    };

    const drawLegend = (ctx, signals, colors, width, height) => {
        ctx.font = "10px monospace";
        let yOffset = height - 15;

        signals.forEach((signal, idx) => {
            const color = colors[idx % colors.length];
            const name = signal.name;

            ctx.fillStyle = color;
            ctx.fillRect(width - 200, yOffset - 8, 10, 10);
            ctx.fillText(name, width - 185, yOffset);
            yOffset -= 15;
        });
    };

    if (!tranData) {
        return null;
    }

    // Group signals
    const allSignals = tranData.series || [];
    const voltageSignals = allSignals.filter(s => s.name.toLowerCase().startsWith("v("));
    const currentSignals = allSignals.filter(s => s.name.toLowerCase().startsWith("i(") || s.name.toLowerCase().includes("[i]"));

    const toggleSignal = (signalName) => {
        setEnabledSignals(prev => {
            const next = new Set(prev);
            if (next.has(signalName)) {
                next.delete(signalName);
            } else {
                next.add(signalName);
            }
            return next;
        });
    };

    return (
        <div className="fixed bottom-4 right-4 flex gap-2 z-50">
            {/* Signal Selector Panel */}
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-3" style={{ width: "200px", maxHeight: "300px", overflowY: "auto" }}>
                <div className="text-xs font-semibold text-neutral-200 mb-2">Channels</div>

                {/* Filter Tabs */}
                <div className="flex gap-1 mb-3">
                    <button
                        onClick={() => setSignalFilter("all")}
                        className={`px-2 py-1 text-[10px] rounded transition-colors ${
                            signalFilter === "all"
                                ? "bg-yellow-600 text-black font-semibold"
                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setSignalFilter("voltage")}
                        className={`px-2 py-1 text-[10px] rounded transition-colors ${
                            signalFilter === "voltage"
                                ? "bg-blue-600 text-white font-semibold"
                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                        }`}
                    >
                        V
                    </button>
                    <button
                        onClick={() => setSignalFilter("current")}
                        className={`px-2 py-1 text-[10px] rounded transition-colors ${
                            signalFilter === "current"
                                ? "bg-red-600 text-white font-semibold"
                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                        }`}
                    >
                        I
                    </button>
                </div>

                {/* Voltages */}
                {(signalFilter === "all" || signalFilter === "voltage") && voltageSignals.length > 0 && (
                    <div className="mb-3">
                        <div className="text-[10px] text-neutral-500 mb-1">Voltages</div>
                        {voltageSignals.map(signal => (
                            <label key={signal.name} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-neutral-800 rounded px-1">
                                <input
                                    type="checkbox"
                                    checked={enabledSignals.has(signal.name)}
                                    onChange={() => toggleSignal(signal.name)}
                                    className="accent-blue-500"
                                />
                                <span className="text-[11px] text-neutral-300 truncate">{signal.name}</span>
                            </label>
                        ))}
                    </div>
                )}

                {/* Currents */}
                {(signalFilter === "all" || signalFilter === "current") && currentSignals.length > 0 && (
                    <div>
                        <div className="text-[10px] text-neutral-500 mb-1">Currents</div>
                        {currentSignals.map(signal => (
                            <label key={signal.name} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-neutral-800 rounded px-1">
                                <input
                                    type="checkbox"
                                    checked={enabledSignals.has(signal.name)}
                                    onChange={() => toggleSignal(signal.name)}
                                    className="accent-red-500"
                                />
                                <span className="text-[11px] text-neutral-300 truncate">{signal.name}</span>
                            </label>
                        ))}
                    </div>
                )}

                {/* Quick Actions */}
                <div className="mt-3 pt-3 border-t border-neutral-700 flex gap-1">
                    <button
                        onClick={() => setEnabledSignals(new Set(allSignals.map(s => s.name)))}
                        className="flex-1 px-2 py-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded"
                    >
                        All
                    </button>
                    <button
                        onClick={() => setEnabledSignals(new Set())}
                        className="flex-1 px-2 py-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded"
                    >
                        None
                    </button>
                </div>
            </div>

            {/* Waveform Display */}
            <div
                className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl"
                style={{ width: "600px", height: "300px" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-700">
                    <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        <span className="text-xs font-semibold text-neutral-200">Live Waveform</span>
                        <span className="text-[10px] text-neutral-500">({enabledSignals.size} signals)</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-neutral-400 hover:text-neutral-200 transition-colors"
                        title="Close"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                {/* Canvas */}
                <div ref={containerRef} className="w-full h-full p-2">
                    <canvas ref={canvasRef} className="w-full h-full" />
                </div>
            </div>
        </div>
    );
}
