import React, { useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

const formatSI = (value, unit) => {
  if (!isNumber(value)) return "—";
  const abs = Math.abs(value);
  if (abs === 0) return `0 ${unit}`;
  if (abs >= 1) return `${value.toFixed(4)} ${unit}`;
  if (abs >= 1e-3) return `${(value * 1e3).toFixed(4)} m${unit}`;
  if (abs >= 1e-6) return `${(value * 1e6).toFixed(4)} µ${unit}`;
  if (abs >= 1e-9) return `${(value * 1e9).toFixed(4)} n${unit}`;
  return `${value.toExponential(3)} ${unit}`;
};

// Auto-scale data and determine appropriate unit
const autoScaleData = (data, unit) => {
  if (!data || data.length === 0) return { scaled: data, scaleFactor: 1, prefix: "", displayUnit: unit };

  // Find max absolute value
  const maxAbs = Math.max(...data.map(v => Math.abs(v)).filter(v => isNumber(v)));

  if (maxAbs === 0) return { scaled: data, scaleFactor: 1, prefix: "", displayUnit: unit };

  // Determine best scale
  let scaleFactor = 1;
  let prefix = "";

  if (maxAbs < 1e-6) {
    scaleFactor = 1e9;
    prefix = "n";
  } else if (maxAbs < 1e-3) {
    scaleFactor = 1e6;
    prefix = "µ";
  } else if (maxAbs < 1) {
    scaleFactor = 1e3;
    prefix = "m";
  }

  const scaled = data.map(v => isNumber(v) ? v * scaleFactor : v);
  const displayUnit = prefix + unit;

  return { scaled, scaleFactor, prefix, displayUnit };
};

const formatTime = (t) => {
  if (!isNumber(t)) return "—";
  const abs = Math.abs(t);
  if (abs >= 1) return `${t.toFixed(4)} s`;
  if (abs >= 1e-3) return `${(t * 1e3).toFixed(4)} ms`;
  if (abs >= 1e-6) return `${(t * 1e6).toFixed(4)} us`;
  if (abs >= 1e-9) return `${(t * 1e9).toFixed(4)} ns`;
  return `${t.toExponential(3)} s`;
};

const unitForTrace = (name) => {
  const n = String(name || "").toLowerCase();
  if (n.startsWith("v(")) return "V";
  if (n.startsWith("i(")) return "A";
  if (n.startsWith("@") && n.endsWith("[i]")) return "A";
  return "";
};

const pickColor = (i) => {
  const palette = [
    "#60a5fa",
    "#34d399",
    "#fbbf24",
    "#f87171",
    "#a78bfa",
    "#22d3ee",
    "#fb7185",
    "#c084fc",
    "#f97316",
  ];
  return palette[i % palette.length];
};

// --- TIME AXIS HELPERS ---
const getTimeUnitInfo = (range) => {
  const abs = Math.abs(range);
  if (abs === 0) return { factor: 1, unit: "s" };
  if (abs >= 1) return { factor: 1, unit: "s" };
  if (abs >= 1e-3) return { factor: 1e3, unit: "ms" };
  if (abs >= 1e-6) return { factor: 1e6, unit: "µs" };
  if (abs >= 1e-9) return { factor: 1e9, unit: "ns" };
  return { factor: 1, unit: "s" }; // fallback
};

// --- FREQUENCY AXIS HELPERS ---
const getFreqUnitInfo = (min, max) => {
  // Use max frequency to determine unit
  const abs = Math.abs(max);
  if (abs >= 1e9) return { factor: 1e-9, unit: "GHz" };
  if (abs >= 1e6) return { factor: 1e-6, unit: "MHz" };
  if (abs >= 1e3) return { factor: 1e-3, unit: "kHz" };
  return { factor: 1, unit: "Hz" };
};

// --- INTERACTIONS HELPER (Zoom, Pan, Reset) ---
const installInteractions = (u, initialData) => {
  // 1. WHEEL ZOOM
  const onWheel = (e) => {
    e.preventDefault();

    const rect = u.root.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { left, top, width, height } = u.bbox;
    
    const isOverPlot = x >= left && x <= left + width && y >= top && y <= top + height;
    const isOverYAxis = x < left && y >= top && y <= top + height;
    const isOverXAxis = x >= left && x <= left + width && y > top + height;
    
    let targetAxis = null;
    if (isOverYAxis) targetAxis = "y";
    else if (isOverXAxis) targetAxis = "x";
    else if (isOverPlot) {
       targetAxis = e.shiftKey ? "y" : "x";
    }

    if (!targetAxis) return;

    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    
    const scaleKey = targetAxis;
    const scale = u.scales[scaleKey];
    if (!scale) return;

    const min = scale.min;
    const max = scale.max;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;

    const span = max - min;
    if (span === 0) return;

    const relPos = scaleKey === "x" ? (x - left) : (y - top);
    let val = u.posToVal(relPos, scaleKey);
    
    if (val < min) val = min;
    if (val > max) val = max;

    const newSpan = span * factor;
    const ratio = (val - min) / span;
    
    const newMin = val - ratio * newSpan;
    const newMax = newMin + newSpan;

    u.setScale(scaleKey, { min: newMin, max: newMax });
  };

  // 2. PANNING (Left Click + Drag)
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initScales = null;

  const onMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only

    // Only start if inside plot area
    const rect = u.over.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { left, top, width, height } = u.bbox;
    
    if (x < left || x > left + width || y < top || y > top + height) return;

    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    initScales = {
      x: { min: u.scales.x.min, max: u.scales.x.max },
      y: { min: u.scales.y.min, max: u.scales.y.max },
    };

    u.over.style.cursor = "grabbing";
  };

  const onMouseMove = (e) => {
    if (!isDragging || !initScales) return;
    e.preventDefault();

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const { width, height } = u.bbox;

    // X Pan
    // dx > 0 (move right) => we want data under cursor to move right => viewport moves left (min decreases)
    // Wait: if I drag paper right, I see what was to the left. 
    // uPlot coordinates: left is min, right is max.
    // If I move mouse +10px (Right). The value at startX should now be at startX + 10.
    // So the value at startX matches pixel startX + 10.
    // This means the range shifted Left.
    const xRange = initScales.x.max - initScales.x.min;
    const xShift = -(dx / width) * xRange;

    u.setScale("x", {
      min: initScales.x.min + xShift,
      max: initScales.x.max + xShift
    });

    // Y Pan
    // dy > 0 (move down). Pixel 0 is top.
    // uPlot Y scale: usually min at bottom? No, uPlot default is min at bottom.
    // If min is bottom:
    // Drag down (+dy). I want data to move down.
    // High values move to larger Y-pixels.
    // The window must shift Up (higher values).
    const yRange = initScales.y.max - initScales.y.min;
    const yShift = (dy / height) * yRange;

    u.setScale("y", {
      min: initScales.y.min + yShift,
      max: initScales.y.max + yShift
    });
  };

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      u.over.style.cursor = "default";
    }
  };

  // 3. DOUBLE CLICK RESET
  const onDblClick = (e) => {
    e.preventDefault();
    // Reset X to full range of data
    if (initialData && initialData[0] && initialData[0].length > 0) {
      const xs = initialData[0];
      const min = xs[0];
      const max = xs[xs.length - 1];
      u.setScale("x", { min, max });
    }
    // Reset Y to auto
    u.setScale("y", { min: null, max: null, auto: true });
  };

  // Attach listeners
  u.root.addEventListener("wheel", onWheel, { passive: false });
  u.over.addEventListener("mousedown", onMouseDown);
  u.over.addEventListener("dblclick", onDblClick);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  return () => {
    u.root.removeEventListener("wheel", onWheel);
    u.over.removeEventListener("mousedown", onMouseDown);
    u.over.removeEventListener("dblclick", onDblClick);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };
};

export default function TransientPlot({ x = [], series = [], selectedNames = [], autoScaleCurrents = false, yAxisLabel = "Value", mode = "tran" }) {
  const containerRef = useRef(null);
  const plotRef = useRef(null);
  const [size, setSize] = useState({ w: 10, h: 10 });
  const [hoverText, setHoverText] = useState("");

  const selected = useMemo(() => {
    const set = new Set(selectedNames || []);
    return (series || []).filter((s) => set.has(s.name));
  }, [series, selectedNames]);

  // Auto-scale current data if needed
  const { data, displayUnit } = useMemo(() => {
    if (!autoScaleCurrents || selected.length === 0) {
      const ys = selected.map((s) => s.y || []);
      return { data: [x || [], ...ys], displayUnit: "A" };
    }

    // All selected are currents - find best scale
    const allCurrentValues = selected.flatMap(s => s.y || []);
    const { scaleFactor, displayUnit: unit } = autoScaleData(allCurrentValues, "A");

    const ys = selected.map((s) => {
      const scaled = (s.y || []).map(v => isNumber(v) ? v * scaleFactor : v);
      return scaled;
    });

    return { data: [x || [], ...ys], displayUnit: unit };
  }, [x, selected, autoScaleCurrents]);

  const opts = useMemo(() => {
    const ySeries = selected.map((s, idx) => ({
      label: s.name,
      stroke: pickColor(idx),
      width: 2.5,
      points: { show: false },
    }));

    const isAc = mode === "ac";

    return {
      width: size.w,
      height: size.h,
      scales: {
        x: {
          time: false,
          distr: isAc ? 3 : 1, // 3 = Logarithmic, 1 = Linear
        }
      },
      axes: [
        {
          label: (u) => {
            const min = u.scales.x.min;
            const max = u.scales.x.max;
            if (isAc) {
              const info = getFreqUnitInfo(min, max);
              return `Frequency (${info.unit})`;
            }
            const info = getTimeUnitInfo(max - min);
            return `Time (${info.unit})`;
          },
          labelSize: 20,
          labelFont: "600 14px system-ui",
          size: 60,
          font: "12px system-ui",
          stroke: "#a3a3a3",
          grid: { show: true, stroke: "#404040", width: 1 },
          ticks: { show: true, stroke: "#737373", width: 1 },
          values: (u, ticks) => {
            const min = u.scales.x.min;
            const max = u.scales.x.max;
            if (isAc) {
              const info = getFreqUnitInfo(min, max);
              return ticks.map(t => (t * info.factor).toFixed(1).replace(/\.0$/, ""));
            }
            const info = getTimeUnitInfo(max - min);
            return ticks.map(t => (t * info.factor).toFixed(2).replace(/\.?0+$/, ""));
          },
        },
        {
          label: autoScaleCurrents ? `Current (${displayUnit})` : yAxisLabel,
          labelSize: 20,
          labelFont: "600 14px system-ui",
          size: 70,
          font: "12px system-ui",
          stroke: "#a3a3a3",
          grid: { show: true, stroke: "#404040", width: 1 },
          ticks: { show: true, stroke: "#737373", width: 1 },
        },
      ],
      series: [
        {
          label: isAc ? "Freq" : "Time",
        },
        ...ySeries
      ],
      legend: {
        show: true,
        live: true,
        markers: {
          width: 2,
          dash: [],
          stroke: (u, seriesIdx) => u.series[seriesIdx].stroke,
        },
      },
      cursor: {
        show: true,
        drag: { x: false, y: false }, // Disable native zoom selection to allow Pan
        sync: { key: "myCursor" },
        points: {
          size: 6,
          width: 2,
        },
      },
      plugins: [
        {
          hooks: {
            setCursor: [
              (u) => {
                const idx = u.cursor.idx;
                if (idx == null) return;
                const xVal = u.data[0]?.[idx];
                const parts = [];
                
                if (isAc) {
                   const info = getFreqUnitInfo(xVal, xVal);
                   parts.push(`f=${(xVal * info.factor).toFixed(2)}${info.unit}`);
                } else {
                   parts.push(`t=${formatTime(xVal)}`);
                }

                for (let i = 0; i < selected.length; i++) {
                  const name = selected[i].name;
                  const v = u.data[i + 1]?.[idx];

                  if (autoScaleCurrents) {
                    // Display in auto-scaled units
                    parts.push(`${name}=${isNumber(v) ? v.toFixed(4) : "—"} ${displayUnit}`);
                  } else {
                    const unit = unitForTrace(name);
                    parts.push(`${name}=${formatSI(v, unit)}`);
                  }
                }
                setHoverText(parts.join("  "));
              },
            ],
          },
        },
      ],
    };
  }, [selected, size.h, size.w, autoScaleCurrents, displayUnit, yAxisLabel, mode]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setSize({ w: Math.max(10, Math.floor(r.width)), h: Math.max(10, Math.floor(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (size.w < 10 || size.h < 10) return;

    if (plotRef.current) {
      plotRef.current.destroy();
      plotRef.current = null;
    }

    if (!data?.[0]?.length || data.length < 2) return;

    const u = new uPlot(opts, data, containerRef.current);
    plotRef.current = u;

    // Install Interactions (Pan, Zoom, Reset)
    const cleanup = installInteractions(u, data);

    return () => {
      cleanup();
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
    };
  }, [data, opts, size.h, size.w]);

  return (
    <div className="w-full">
      <div className="mb-3 rounded-lg border border-neutral-700 bg-linear-to-r from-neutral-900 to-neutral-800 px-4 py-2.5 text-sm font-mono text-white shadow-lg">
        {hoverText || "Hover over the graph to see values"}
      </div>
      <div className="h-96 w-full bg-neutral-950 rounded-lg border border-neutral-800 p-4" ref={containerRef} />
      <div className="mt-2 text-xs text-neutral-400 flex items-center gap-2">
        <span className="font-semibold">💡 Tip:</span>
        <span>Drag to pan • Wheel to zoom X (Shift+Wheel for Y) • Double-click to reset</span>
      </div>
    </div>
  );
}