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

export default function TransientPlot({ x = [], series = [], selectedNames = [], autoScaleCurrents = false, yAxisLabel = "Value" }) {
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

    return {
      width: size.w,
      height: size.h,
      scales: { x: { time: false } },
      axes: [
        {
          label: "Time",
          labelSize: 20,
          labelFont: "600 14px system-ui",
          size: 60,
          font: "12px system-ui",
          stroke: "#a3a3a3",
          grid: { show: true, stroke: "#404040", width: 1 },
          ticks: { show: true, stroke: "#737373", width: 1 },
          values: (u, ticks) => ticks.map((t) => formatTime(t)),
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
          label: "Time",
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
        drag: { x: true, y: false },
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
                const t = u.data[0]?.[idx];
                const parts = [];
                parts.push(`t=${formatTime(t)}`);
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
  }, [selected, size.h, size.w, autoScaleCurrents, displayUnit, yAxisLabel]);

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

    plotRef.current = new uPlot(opts, data, containerRef.current);
    return () => {
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
        <span>Drag horizontally to zoom • Double-click to reset zoom</span>
      </div>
    </div>
  );
}




// import React, { forwardRef, useEffect, useMemo, useRef, useState, useImperativeHandle } from "react";
// import uPlot from "uplot";
// import "uplot/dist/uPlot.min.css";

// const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

// function clampFinite(v, fallback) {
//   return Number.isFinite(v) ? v : fallback;
// }

// function zoomScale(u, scaleKey, factor, centerVal) {
//   const sc = u.scales[scaleKey];
//   if (!sc) return;

//   const min = clampFinite(sc.min, 0);
//   const max = clampFinite(sc.max, 1);
//   if (!(max > min)) return;

//   const c = clampFinite(centerVal, (min + max) / 2);
//   const span = max - min;
//   const nextSpan = span * factor;

//   const t = (c - min) / span;
//   const nextMin = c - nextSpan * t;
//   const nextMax = nextMin + nextSpan;

//   u.setScale(scaleKey, { min: nextMin, max: nextMax });
// }

// function resetScales(u, data) {
//   if (!u || !data || !data[0] || data[0].length < 2) return;
//   const x = data[0];
//   u.setScale("x", { min: x[0], max: x[x.length - 1] });
//   u.setScale("y", { auto: true });
// }

// function fitY(u) {
//   if (!u) return;
//   u.setScale("y", { auto: true });
// }

// const pickColor = (i) => {
//   const palette = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#22d3ee", "#fb7185"];
//   return palette[i % palette.length];
// };

// const TransientPlot = forwardRef(function TransientPlot(
//   { x = [], series = [], selectedNames = [], autoScaleCurrents = false, yAxisLabel = "Value" },
//   ref
// ) {
//   const containerRef = useRef(null);
//   const plotHostRef = useRef(null);
//   const uRef = useRef(null);

//   // ✅ preserve last visible scales across re-creates
//   const lastScalesRef = useRef(null);

//   const [size, setSize] = useState({ w: 10, h: 10 });
//   const [hoverText, setHoverText] = useState("");

//   const selected = useMemo(() => {
//     const set = new Set(selectedNames || []);
//     return (series || []).filter((s) => set.has(s.name));
//   }, [series, selectedNames]);

//   const data = useMemo(() => {
//     if (selected.length === 0) return [x || []];
//     return [x || [], ...selected.map((s) => s.y || [])];
//   }, [x, selected]);

//   const opts = useMemo(() => {
//     const ySeries = selected.map((s, idx) => ({
//       label: s.name,
//       stroke: pickColor(idx),
//       width: 2.25,
//       points: { show: false },
//     }));

//     return {
//       width: size.w,
//       height: size.h,
//       scales: { x: { time: false }, y: {} },
//       axes: [
//         {
//           label: "Time",
//           size: 56,
//           stroke: "#a3a3a3",
//           grid: { show: true, stroke: "#303030", width: 1 },
//           ticks: { show: true, stroke: "#525252", width: 1 },
//         },
//         {
//           label: yAxisLabel,
//           size: 66,
//           stroke: "#a3a3a3",
//           grid: { show: true, stroke: "#303030", width: 1 },
//           ticks: { show: true, stroke: "#525252", width: 1 },
//         },
//       ],
//       series: [{ label: "Time" }, ...ySeries],
//       cursor: {
//         show: true,
//         drag: { x: true, y: false },
//       },
//       hooks: {
//         setCursor: [
//           (u) => {
//             const idx = u.cursor.idx;
//             if (idx == null) return;
//             const t = u.data[0]?.[idx];
//             const parts = [`t=${t?.toFixed?.(6) ?? t}`];
//             for (let i = 0; i < selected.length; i++) {
//               const name = selected[i].name;
//               const v = u.data[i + 1]?.[idx];
//               parts.push(`${name}=${isNumber(v) ? v.toFixed(6) : "—"}`);
//             }
//             setHoverText(parts.join("   "));
//           },
//         ],
//         // ✅ track scales so resize doesn’t “jump”
//         setScale: [
//           (u) => {
//             lastScalesRef.current = {
//               x: { min: u.scales.x.min, max: u.scales.x.max },
//               y: { min: u.scales.y.min, max: u.scales.y.max },
//             };
//           },
//         ],
//       },
//     };
//   }, [selected, size.h, size.w, yAxisLabel]);

//   useImperativeHandle(ref, () => ({
//     zoomX: (factor = 0.8) => {
//       const u = uRef.current;
//       if (!u) return;
//       const sc = u.scales.x;
//       const center = (clampFinite(sc.min, 0) + clampFinite(sc.max, 1)) / 2;
//       zoomScale(u, "x", factor, center);
//     },
//     zoomY: (factor = 0.8) => {
//       const u = uRef.current;
//       if (!u) return;
//       const sc = u.scales.y;
//       const center = (clampFinite(sc.min, 0) + clampFinite(sc.max, 1)) / 2;
//       zoomScale(u, "y", factor, center);
//     },
//     reset: () => resetScales(uRef.current, data),
//     fitY: () => fitY(uRef.current),
//   }));

//   useEffect(() => {
//     if (!containerRef.current) return;
//     const el = containerRef.current;

//     const ro = new ResizeObserver((entries) => {
//       const r = entries[0]?.contentRect;
//       if (!r) return;
//       setSize({ w: Math.max(10, Math.floor(r.width)), h: Math.max(10, Math.floor(r.height)) });
//     });

//     ro.observe(el);
//     return () => ro.disconnect();
//   }, []);

//   useEffect(() => {
//     const host = plotHostRef.current;
//     if (!host) return;
//     if (size.w < 10 || size.h < 10) return;

//     if (uRef.current) {
//       uRef.current.destroy();
//       uRef.current = null;
//     }

//     if (!data?.[0]?.length || data.length < 2) return;

//     const u = new uPlot(opts, data, host);
//     uRef.current = u;

//     // ✅ restore last scales if present
//     const last = lastScalesRef.current;
//     if (last?.x?.min != null && last?.x?.max != null) {
//       u.setScale("x", { min: last.x.min, max: last.x.max });
//     }
//     if (last?.y?.min != null && last?.y?.max != null) {
//       u.setScale("y", { min: last.y.min, max: last.y.max });
//     }

//     // Wheel zoom only when cursor is inside the plot root
//     const onWheel = (e) => {
//       if (!uRef.current) return;

//       const rect = u.root.getBoundingClientRect();
//       const inside =
//         e.clientX >= rect.left &&
//         e.clientX <= rect.right &&
//         e.clientY >= rect.top &&
//         e.clientY <= rect.bottom;

//       if (!inside) return;

//       e.preventDefault();

//       const ox = e.clientX - rect.left;
//       const oy = e.clientY - rect.top;

//       const zoomIn = e.deltaY < 0;
//       const base = 1.12;
//       const factor = zoomIn ? 1 / base : base;

//       if (e.shiftKey) {
//         const yVal = u.posToVal(oy, "y");
//         zoomScale(u, "y", factor, yVal);
//       } else {
//         const xVal = u.posToVal(ox, "x");
//         zoomScale(u, "x", factor, xVal);
//       }
//     };

//     const onDblClick = (e) => {
//       e.preventDefault();
//       resetScales(uRef.current, data);
//     };

//     u.root.addEventListener("wheel", onWheel, { passive: false });
//     u.root.addEventListener("dblclick", onDblClick);

//     return () => {
//       try {
//         u.root.removeEventListener("wheel", onWheel);
//         u.root.removeEventListener("dblclick", onDblClick);
//       } catch {}
//       if (uRef.current) {
//         uRef.current.destroy();
//         uRef.current = null;
//       }
//     };
//   }, [data, opts, size.h, size.w]);

//   return (
//     <div ref={containerRef} className="h-full w-full flex flex-col min-h-0">
//       <div className="mb-3 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-[12px] font-mono text-white">
//         {hoverText || "Hover over the graph to see values"}
//       </div>

//       <div className="flex-1 min-h-0 w-full">
//         <div ref={plotHostRef} className="h-full w-full bg-neutral-950 rounded-xl border border-neutral-800 p-3" />
//       </div>

//       <div className="mt-2 text-[11px] text-neutral-400">
//         Wheel: zoom X • Shift+Wheel: zoom Y • Drag: X zoom • Double-click: reset
//       </div>
//     </div>
//   );
// });

// export default TransientPlot;
