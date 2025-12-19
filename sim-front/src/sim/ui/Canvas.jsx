import React, { useRef, useState } from "react";
import { KIND, LV } from "../model/types";

const PIN_RADIUS = 10;
const WIRE_HIT_PX = 8;
const GRID = 24;

// -------- visuals ----------
const wireColorForValue = (v) => {
  if (v === LV.HIGH) return "#FAD90E";
  if (v === LV.LOW) return "#9CA3AF";
  return "#60A5FA";
};

const pinDot = (ctx, x, y, v) => {
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = v === LV.HIGH ? "#FAD90E" : v === LV.LOW ? "#555" : "#9CA3AF";
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.stroke();
};

const snap = (n) => Math.round(n / GRID) * GRID;

// Gate drawing functions
const drawAndGate = (ctx, x, y, w, h) => {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w / 2, y + h);
  ctx.arc(x + w / 2, y + h / 2, h / 2, Math.PI / 2, -Math.PI / 2, true);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
};

const drawOrGate = (ctx, x, y, w, h) => {
  ctx.beginPath();
  // Back curve
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w * 0.2, y + h / 2, x, y + h);
  // Bottom to output - less pointed, more rounded
  ctx.bezierCurveTo(
    x + w * 0.3, y + h * 0.9,
    x + w * 0.7, y + h * 0.7,
    x + w, y + h / 2
  );
  // Top from output - less pointed, more rounded
  ctx.bezierCurveTo(
    x + w * 0.7, y + h * 0.3,
    x + w * 0.3, y + h * 0.1,
    x, y
  );
  ctx.closePath();
};

const drawXorGate = (ctx, x, y, w, h) => {
  // Extra line for XOR
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.quadraticCurveTo(x - 6 + w * 0.15, y + h / 2, x - 6, y + h);
  ctx.stroke();

  // Main OR shape
  drawOrGate(ctx, x, y, w, h);
};

const drawNotGate = (ctx, x, y, w, h) => {
  const triangleW = w - 10; // Leave space for inverter bubble

  ctx.beginPath();
  // Triangle
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + triangleW, y + h / 2);
  ctx.closePath();
};

const drawInverterBubble = (ctx, x, y, radius = 5) => {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
};

export default function Canvas({
  circuit,
  onPlace,
  onToggleInput,
  onConnectPins,
  onMoveComponent,
  onDeleteComponent,
  onDuplicateComponent,
  onDeleteWire,
  onDeleteMultiple,
  onUpdateWire,
  onSplitWire,
  onSplitWireAndStartDraft,
  onToggleClockMode,
  onSetComponentValue,
  onSetButtonPressed,
  onSelectionChange, // ✅ ADD THIS
}) {
  const ref = useRef(null);

  // Draft wire:
  // fromPinId: starting output pin
  // points: intermediate locked points (polyline vertices)
  const [draft, setDraft] = useState(null); // { fromPinId, points: [{x,y}...] }
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const [selectedCompId, setSelectedCompId] = useState(null);
  const [selectedWireId, setSelectedWireId] = useState(null);

  // Multi-select state
  const [selectedCompIds, setSelectedCompIds] = useState([]); // Array of component IDs
  const [selectedWireIds, setSelectedWireIds] = useState([]); // Array of wire IDs

  const [drag, setDrag] = useState(null); // { compId, dx, dy }
  const [wireDrag, setWireDrag] = useState(null); // { wireId, dx, dy }
  const [pointDrag, setPointDrag] = useState(null); // { wireId, pointIndex, dx, dy }
  const [selectionBox, setSelectionBox] = useState(null); // { startX, startY, currentX, currentY }
  const [activeClockId, setActiveClockId] = useState(null);
  const [activeButtonId, setActiveButtonId] = useState(null);
  const [menu, setMenu] = useState(null);
  const closeMenu = () => setMenu(null);

  // Hover states for UX feedback
  const [hoveredPin, setHoveredPin] = useState(null); // { comp, pin, x, y }
  const [hoveredJunction, setHoveredJunction] = useState(null); // component object
  const [hoveredComponent, setHoveredComponent] = useState(null); // component object
  const [toast, setToast] = useState(null); // { message }

  const dragMovedRef = React.useRef(false);
  const suppressClickRef = React.useRef(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });

  React.useEffect(() => {
    if (typeof onSelectionChange === "function") {
      // Combine single and multi selections for external consumers
      const allCompIds = [...selectedCompIds];
      if (selectedCompId && !allCompIds.includes(selectedCompId)) {
        allCompIds.push(selectedCompId);
      }
      
      const allWireIds = [...selectedWireIds];
      if (selectedWireId && !allWireIds.includes(selectedWireId)) {
        allWireIds.push(selectedWireId);
      }

      onSelectionChange({ compIds: allCompIds, wireIds: allWireIds });
    }
  }, [selectedCompIds, selectedWireIds, selectedCompId, selectedWireId]);


  const draw = () => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // bg
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // grid
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#2a2a2a";
    for (let x = 0; x < rect.width; x += GRID) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += GRID) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ---- wires (polyline) ----
    for (const w of circuit.wires) {

      const from = findPinPos(circuit, w.fromPinId);
      const to = findPinPos(circuit, w.toPinId);
      if (!from || !to) continue;

      const isSel = w.id === selectedWireId || selectedWireIds.includes(w.id);

      const fromPin = findPin(circuit, w.fromPinId);
      const v = fromPin?.pin?.value ?? LV.X;

      ctx.strokeStyle = isSel ? "#FAD90E" : wireColorForValue(v);
      ctx.lineWidth = isSel ? 4 : 3;

      const pts = buildWirePolyline(from, to, w.points);
      drawPolyline(ctx, pts);




      if (isSel) {
        for (const p of pts) {
          ctx.fillStyle = "#FAD90E";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }



    // ---- preview draft ----
    if (draft) {
      const from = findPinPos(circuit, draft.fromPinId);
      if (from) {
        ctx.strokeStyle = "#FAD90E";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);

        // Use raw mouse position for smooth preview (snap only when clicking)
        const previewEnd = { x: mouse.x, y: mouse.y };
        const pts = buildDraftPolyline(from, draft.points, previewEnd);
        drawPolyline(ctx, pts);

        // draw the locked points as small squares
        ctx.setLineDash([]);
        for (const p of draft.points) {
          ctx.fillStyle = "rgba(250,217,14,0.9)";
          ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        }
      }
    }

    // ---- components ----
    for (const c of circuit.components) {
      const isSel = c.id === selectedCompId || selectedCompIds.includes(c.id);

      ctx.save();
      
      // Apply Rotation
      if (c.rotate && c.kind !== KIND.JUNCTION) {
         const cx = c.x + c.w / 2;
         const cy = c.y + c.h / 2;
         ctx.translate(cx, cy);
         ctx.rotate((c.rotate * 90 * Math.PI) / 180);
         ctx.translate(-cx, -cy);
      }

      // Use basePinPosition for local drawing, since context is rotated
      const pinPosition = (cc, pp) => basePinPosition(cc, pp);

      // ✅ Special rendering for junction (NO box/title/pins)
      if (c.kind === KIND.JUNCTION) {
        const inputPin = c.pins.find((p) => p.name === "IN");
        const v = inputPin?.value ?? LV.X;

        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;

        const isHovered = hoveredJunction?.id === c.id;

        // Hover highlight (before the normal glow)
        if (isHovered) {
          ctx.save();
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(cx, cy, 18, 0, Math.PI * 2);

          if (draft) {
            // During draft: show green for valid, red for invalid
            const fromMeta = getPinMeta(draft.fromPinId);
            const jInPin = c.pins.find((p) => p.name === "IN");
            const jOutPin = c.pins.find((p) => p.name === "OUT");

            let isValid = false;
            if (fromMeta) {
              // OUT can connect to junction IN, IN can connect to junction OUT
              if (fromMeta.pin.dir === "out" && jInPin) isValid = true;
              if (fromMeta.pin.dir === "in" && jOutPin) isValid = true;
            }

            ctx.fillStyle = isValid ? "#10b981" : "#ef4444";
          } else {
            // Not drafting: neutral highlight
            ctx.fillStyle = "#60a5fa";
          }
          ctx.fill();
          ctx.restore();
        }

        // subtle glow
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.fillStyle = wireColorForValue(v);
        ctx.fill();
        ctx.restore();

        // outer ring
        ctx.beginPath();
        ctx.arc(cx, cy, isSel ? 10 : 9, 0, Math.PI * 2);
        ctx.strokeStyle = isSel ? "#FAD90E" : "rgba(255,255,255,0.25)";
        ctx.lineWidth = isSel ? 3 : 2;
        ctx.stroke();

        // inner dot (matches wire value color)
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = wireColorForValue(v);
        ctx.fill();

        ctx.restore();
        continue;
      }

      if (c.kind === KIND.INPUT) {
        const isOn = c.state.value === LV.HIGH;
        const isSel = c.id === selectedCompId || selectedCompIds.includes(c.id);

        // Selection highlight (subtle glow instead of bulky box)
        if (isSel) {
          ctx.beginPath();
          ctx.arc(c.x + 30, c.y + 30, 25, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(250, 217, 14, 0.1)";
          ctx.fill();
          ctx.strokeStyle = "rgba(250, 217, 14, 0.3)";
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Switch track
        ctx.fillStyle = isOn ? "#064e3b" : "#262626";
        roundRect(ctx, c.x + 10, c.y + 20, 40, 20, 10);
        ctx.fill();

        // Switch knob
        ctx.fillStyle = isOn ? "#10b981" : "#525252";
        ctx.beginPath();
        ctx.arc(isOn ? c.x + 40 : c.x + 20, c.y + 30, 8, 0, Math.PI * 2);
        ctx.fill();

        // Value text
        ctx.fillStyle = isOn ? "#10b981" : "#737373";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(isOn ? "ON" : "OFF", c.x + 30, c.y + 55);
        ctx.textAlign = "left";

                // Draw pin

                for (const p of c.pins) {

                  const pos = pinPosition(c, p);

        

                  // Check if this pin is hovered

                  const isHovered = hoveredPin?.pin?.id === p.id;

                  if (isHovered) {

                     ctx.save();

                     ctx.globalAlpha = 0.5;

                     ctx.beginPath();

                     ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);

                     

                     if (draft) {

                         const fromMeta = getPinMeta(draft.fromPinId);

                         let isValid = false;

                         if (fromMeta) {

                             if (fromMeta.pin.dir === "out" && p.dir === "in") isValid = true;

                             if (fromMeta.pin.dir === "in" && p.dir === "out") isValid = true;

                         }

                         ctx.fillStyle = isValid ? "#10b981" : "#ef4444";

                     } else {

                         ctx.fillStyle = "#60a5fa";

                     }

                     ctx.fill();

                     ctx.restore();

                  }

        

                  pinDot(ctx, pos.x, pos.y, p.value);

                }

                

                ctx.restore();
        continue;

              }

      if (c.kind === KIND.BUTTON) {
        const isPressed = !!c.state.pressed;
        const isSel = c.id === selectedCompId || selectedCompIds.includes(c.id);

        // Selection highlight
        if (isSel) {
          ctx.beginPath();
          ctx.arc(c.x + 30, c.y + 30, 25, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(250, 217, 14, 0.1)";
          ctx.fill();
          ctx.strokeStyle = "rgba(250, 217, 14, 0.3)";
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Button circle
        ctx.fillStyle = isPressed ? "#10b981" : "#333";
        ctx.beginPath();
        ctx.arc(c.x + 30, c.y + 30, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isPressed ? "#065f46" : "#555";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Label
        ctx.fillStyle = isPressed ? "#000" : "#888";
        ctx.font = "bold 9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("PUSH", c.x + 30, c.y + 33);
        ctx.textAlign = "left";

        // Draw pin
        for (const p of c.pins) {
          const pos = pinPosition(c, p);
          pinDot(ctx, pos.x, pos.y, p.value);
        }
        ctx.restore();
        continue;
      }

      if (c.kind === KIND.LED) {
        const isSel = c.id === selectedCompId || selectedCompIds.includes(c.id);
        const inPin = c.pins.find((p) => p.name === "IN");
        const on = inPin?.value === LV.HIGH;

        // Selection highlight
        if (isSel) {
          ctx.beginPath();
          ctx.arc(c.x + 30, c.y + 30, 25, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(250, 217, 14, 0.1)";
          ctx.fill();
          ctx.strokeStyle = "rgba(250, 217, 14, 0.3)";
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Bulb Body (Glass)
        ctx.beginPath();
        ctx.arc(c.x + 30, c.y + 30, 15, 0, Math.PI * 2);

        if (on) {
          // Glow effect
          ctx.shadowColor = "#00ff00";
          ctx.shadowBlur = 20;
          ctx.fillStyle = "#4ade80"; // Bright green
          ctx.fill();
          ctx.shadowBlur = 0; // Reset
        } else {
          ctx.fillStyle = "#14532d"; // Dark green
          ctx.fill();
        }

        // Reflection/Shine
        ctx.beginPath();
        ctx.arc(c.x + 25, c.y + 25, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fill();

        // Rim
        ctx.beginPath();
        ctx.arc(c.x + 30, c.y + 30, 15, 0, Math.PI * 2);
        ctx.strokeStyle = on ? "#22c55e" : "#064e3b";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw pin
        for (const p of c.pins) {
          const pos = pinPosition(c, p);
          pinDot(ctx, pos.x, pos.y, p.value);
        }
        ctx.restore();
        continue;
      }

      if (c.kind === KIND.PROBE) {
        ctx.fillStyle = "#121212";
        ctx.strokeStyle = isSel ? "#FAD90E" : "#333";
        ctx.lineWidth = isSel ? 3 : 2;
        roundRect(ctx, c.x, c.y, c.w, c.h, 12);
        ctx.fill();
        ctx.stroke();

        const inPin = c.pins.find((p) => p.name === "IN");
        const v = inPin?.value;
        const txt = v === LV.HIGH ? "1" : v === LV.LOW ? "0" : "X";

        ctx.fillStyle = v === LV.HIGH ? "#FAD90E" : v === LV.LOW ? "#555" : "#60A5FA";
        ctx.font = "bold 24px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(txt, c.x + c.w / 2, c.y + c.h / 2);
        ctx.textAlign = "left"; // Reset
        ctx.textBaseline = "alphabetic"; // Reset

        // Label
        ctx.fillStyle = "#e5e5e5";
        ctx.font = "12px system-ui";
        ctx.fillText("Probe", c.x + 12, c.y + 18);

        // Draw pin
        for (const p of c.pins) {
          const pos = pinPosition(c, p);
          pinDot(ctx, pos.x, pos.y, p.value);
        }
        ctx.restore();
        continue;
      }

      if (c.kind === KIND.CLOCK) {
        ctx.fillStyle = "#121212";
        ctx.strokeStyle = isSel ? "#FAD90E" : "#333";
        ctx.lineWidth = isSel ? 3 : 2;
        roundRect(ctx, c.x, c.y, c.w, c.h, 12);
        ctx.fill();
        ctx.stroke();

        const v = c.state.value;
        const mode = c.state.mode || "AUTO";

        // visual indicator of clock state
        ctx.fillStyle = v === LV.HIGH ? "#10b981" : "#333";
        ctx.beginPath();
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 14, 0, Math.PI * 2);
        ctx.fill();

        // Mode indicator text
        ctx.fillStyle = v === LV.HIGH ? "#000" : "#888";
        ctx.font = "bold 14px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(mode === "AUTO" ? "A" : "M", c.x + c.w / 2, c.y + c.h / 2 + 1);

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        // Label
        ctx.fillStyle = "#e5e5e5";
        ctx.font = "12px system-ui";
        ctx.fillText("CLK", c.x + 12, c.y + 18);

        // Draw pin
        for (const p of c.pins) {
          const pos = pinPosition(c, p);
          pinDot(ctx, pos.x, pos.y, p.value);
        }
        ctx.restore();
        continue;
      }

      if (
        c.kind === KIND.SR_LATCH ||
        c.kind === KIND.D_FF ||
        c.kind === KIND.JK_FF ||
        c.kind === KIND.T_FF
      ) {
        ctx.fillStyle = "#121212";
        ctx.strokeStyle = isSel ? "#FAD90E" : "#333";
        ctx.lineWidth = isSel ? 3 : 2;
        roundRect(ctx, c.x, c.y, c.w, c.h, 12);
        ctx.fill();
        ctx.stroke();

        // Title
        ctx.fillStyle = "#e5e5e5";
        ctx.font = "bold 14px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        drawStraightText(
          ctx,
          c.kind.replace("_LATCH", "").replace("_FF", ""),
          c.x + c.w / 2,
          c.y + c.h / 2,
          c
        );
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        // Draw Pin Labels
        ctx.font = "12px system-ui";
        for (const p of c.pins) {
          const pos = pinPosition(c, p);

          if (p.name === "CLK") {
            // Draw triangle
            ctx.beginPath();
            ctx.moveTo(c.x, pos.y - 5);
            ctx.lineTo(c.x + 8, pos.y);
            ctx.lineTo(c.x, pos.y + 5);
            ctx.strokeStyle = "#999";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Label
            ctx.fillStyle = "#aaa";
            ctx.fillText("CLK", c.x + 10, pos.y + 4);
          } else if (p.name === "PRE") {
            ctx.fillStyle = "#aaa";
            ctx.textAlign = "center";
            ctx.fillText("PRE", pos.x, pos.y + 12);
            ctx.textAlign = "left";
          } else if (p.name === "CLR") {
            ctx.fillStyle = "#aaa";
            ctx.textAlign = "center";
            ctx.fillText("CLR", pos.x, pos.y - 5);
            ctx.textAlign = "left";
          } else {
            ctx.fillStyle = "#aaa";
            const offset = p.dir === "in" ? 8 : -8;
            ctx.textAlign = p.dir === "in" ? "left" : "right";
            ctx.fillText(p.name, pos.x + offset, pos.y + 4);
          }

          // Draw pin dot
          const isHovered = hoveredPin?.pin?.id === p.id;
          if (isHovered) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
            ctx.fillStyle = "#60a5fa";
            ctx.fill();
            ctx.restore();
          }
          pinDot(ctx, pos.x, pos.y, p.value);
        }
        ctx.textAlign = "left"; // reset
        ctx.restore();
        continue;
      }

// ✅ NEW: 555 Timer IC (clean style: dots only, bigger spacing)
if (c.kind === KIND.TIMER_555) {
  // chip body
  ctx.fillStyle = "#0b0b0b";
  ctx.strokeStyle = isSel ? "#FAD90E" : "#444";
  ctx.lineWidth = isSel ? 3 : 2;
  roundRect(ctx, c.x, c.y, c.w, c.h, 12);
  ctx.fill();
  ctx.stroke();

  // center text "555"
  ctx.fillStyle = "#FAD90E";
  ctx.font = "bold 44px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawStraightText(ctx, "555", c.x + c.w / 2, c.y + c.h / 2, c);

  // pins (dots + labels + pin numbers)
  for (const p of c.pins) {
    const pos = pinPosition(c, p);

    const side = p.side || (p.dir === "in" ? "left" : "right");
    const label = (p.label ?? p.name ?? "").toLowerCase();

    // ✅ NEW: draw only dot (no lead lines)
    pinDot(ctx, pos.x, pos.y, p.value);

    // hover highlight
    const isHovered = hoveredPin?.pin?.id === p.id;
    if (isHovered) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#60a5fa";
      ctx.fill();
      ctx.restore();
    }

    // pin number
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let nx = pos.x, ny = pos.y;
    if (side === "left")   { nx = pos.x + 18; ny = pos.y - 10; }
    if (side === "right")  { nx = pos.x - 18; ny = pos.y - 10; }
    if (side === "top")    { nx = pos.x;      ny = pos.y + 18; }
    if (side === "bottom") { nx = pos.x;      ny = pos.y - 18; }

    ctx.fillText(String(p.num ?? ""), nx, ny);

    // label text (place it slightly further from the dot)
    ctx.fillStyle = "#9ca3af";
    ctx.font = "13px system-ui";

    if (side === "left") {
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(label, pos.x + 26, pos.y + 5);
    } else if (side === "right") {
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(label, pos.x - 26, pos.y + 5);
    } else if (side === "top") {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(label, pos.x, pos.y + 44);
    } else if (side === "bottom") {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(label, pos.x, pos.y - 30);
    }
  }

  // reset text settings
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  continue;
}




      // ✅ NEW: Draw Custom ICs
      if (c.kind === "IC_CUSTOM") {
        const icDef = circuit.icDefinitions?.find(d => d.id === c.icDefinitionId);
        const name = icDef ? icDef.name : "UNKNOWN_IC";

        // Draw chip body
        ctx.fillStyle = "#1a1a2e"; // Dark blue/slate for ICs
        ctx.strokeStyle = isSel ? "#FAD90E" : "#555";
        ctx.lineWidth = isSel ? 3 : 2;
        roundRect(ctx, c.x, c.y, c.w, c.h, 8);
        ctx.fill();
        ctx.stroke();

        // Draw IC name
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        drawStraightText(ctx, name, c.x + c.w / 2, c.y + 20, c);
        ctx.textAlign = "left";

        // Draw pins with labels
        ctx.font = "10px monospace";
        for (const p of c.pins) {
          const pos = pinPosition(c, p);

          // Pin label
          ctx.fillStyle = "#bbb";
          const offset = p.dir === "in" ? 8 : -8;
          ctx.textAlign = p.dir === "in" ? "left" : "right";
          ctx.fillText(p.name, pos.x + offset, pos.y + 4);

          // Hover highlight
          const isHovered = hoveredPin?.pin?.id === p.id;
          if (isHovered) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
            ctx.fillStyle = "#60a5fa";
            ctx.fill();
            ctx.restore();
          }

          pinDot(ctx, pos.x, pos.y, p.value);
        }
        ctx.textAlign = "left"; // reset
        ctx.restore();
        continue;
      }

      if (c.kind === KIND.MUX || c.kind === KIND.DEMUX) {
        ctx.fillStyle = "#121212";
        ctx.strokeStyle = isSel ? "#FAD90E" : "#333";
        ctx.lineWidth = isSel ? 3 : 2;
        roundRect(ctx, c.x, c.y, c.w, c.h, 12);
        ctx.fill();
        ctx.stroke();

        // Title
        ctx.fillStyle = "#e5e5e5";
        ctx.font = "bold 14px system-ui";
        ctx.textAlign = "center";
        drawStraightText(
          ctx,
          c.kind === KIND.MUX ? `MUX ${c.props.size}:1` : `DEMUX 1:${c.props.size}`,
          c.x + c.w / 2,
          c.y + 20,
          c
        );
        ctx.textAlign = "left";

        // Draw Pin Labels
        ctx.font = "10px system-ui";
        for (const p of c.pins) {
          const pos = pinPosition(c, p);

          if (p.name.startsWith("S")) {
            // Selectors at bottom: draw label above pin
            ctx.fillStyle = "#aaa";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(p.name, pos.x, pos.y - 4);
            ctx.textBaseline = "alphabetic"; // Reset
          } else {
            // Side pins
            ctx.fillStyle = "#aaa";
            const offset = p.dir === "in" ? 8 : -8;
            ctx.textAlign = p.dir === "in" ? "left" : "right";
            ctx.fillText(p.name, pos.x + offset, pos.y + 4);
          }

          // Draw pin dot
          const isHovered = hoveredPin?.pin?.id === p.id;
          if (isHovered) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
            ctx.fillStyle = "#60a5fa";
            ctx.fill();
            ctx.restore();
          }
          pinDot(ctx, pos.x, pos.y, p.value);
        }
        ctx.textAlign = "left"; // reset
        ctx.restore();
        continue;
      }

      if (c.kind === KIND.BCD_7SEG) {
        ctx.fillStyle = "#121212";
        ctx.strokeStyle = isSel ? "#FAD90E" : "#333";
        ctx.lineWidth = isSel ? 3 : 2;
        roundRect(ctx, c.x, c.y, c.w, c.h, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#e5e5e5";
        ctx.font = "bold 14px system-ui";
        ctx.textAlign = "center";
        drawStraightText(ctx, "BCD -> 7SEG", c.x + c.w / 2, c.y + 20, c);
        ctx.textAlign = "left";

        ctx.font = "10px system-ui";
        for (const p of c.pins) {
          const pos = pinPosition(c, p);
          
          ctx.fillStyle = "#aaa";
          const offset = p.dir === "in" ? 8 : -8;
          ctx.textAlign = p.dir === "in" ? "left" : "right";
          ctx.fillText(p.name, pos.x + offset, pos.y + 4);

          const isHovered = hoveredPin?.pin?.id === p.id;
          if (isHovered) {
             ctx.save();
             ctx.globalAlpha = 0.5;
             ctx.beginPath();
             ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
             ctx.fillStyle = "#60a5fa";
             ctx.fill();
             ctx.restore();
          }
          pinDot(ctx, pos.x, pos.y, p.value);
        }
        ctx.textAlign = "left";
        ctx.restore();
        continue;
      }

      if (c.kind === KIND.SEVEN_SEGMENT) {
        // Draw body
        ctx.fillStyle = "#111";
        ctx.strokeStyle = isSel ? "#FAD90E" : "#444";
        ctx.lineWidth = isSel ? 3 : 2;
        roundRect(ctx, c.x, c.y, c.w, c.h, 4);
        ctx.fill();
        ctx.stroke();

        // Helper to get pin value
        const getVal = (name) => c.pins.find(p => p.name === name)?.value;

        // Draw segments
        // Center x,y relative to component
        const cx = c.x + c.w * 0.6; 
        const cy = c.y + c.h / 2;
        const sw = 40; // width of digit
        const sh = 60; // height of digit
        const t = 5;   // thickness

        // Offsets for segments a-g
        // a: top
        // b: top-right
        // c: bottom-right
        // d: bottom
        // e: bottom-left
        // f: top-left
        // g: middle

        const drawH = (x, y, active) => {
            ctx.beginPath();
            ctx.moveTo(x + t, y);
            ctx.lineTo(x + sw - t, y);
            ctx.lineTo(x + sw - t - t, y + t);
            ctx.lineTo(x + t + t, y + t);
            ctx.closePath();
            ctx.fillStyle = active === LV.HIGH ? "#ff0000" : "#330000";
            ctx.fill();
        };

        const drawV = (x, y, active) => {
             ctx.beginPath();
             ctx.moveTo(x, y + t);
             ctx.lineTo(x + t, y + t + t);
             ctx.lineTo(x + t, y + sh/2 - t - t);
             ctx.lineTo(x, y + sh/2 - t);
             ctx.closePath();
             ctx.fillStyle = active === LV.HIGH ? "#ff0000" : "#330000";
             ctx.fill();
        }

        // Segment coordinates definitions
        // A simple approach: defined rects or paths
        const segs = {
            a: { x: cx - sw/2, y: cy - sh/2, type: 'h' },
            b: { x: cx + sw/2 - t, y: cy - sh/2, type: 'v' },
            c: { x: cx + sw/2 - t, y: cy, type: 'v' },
            d: { x: cx - sw/2, y: cy + sh/2 - t, type: 'h' },
            e: { x: cx - sw/2, y: cy, type: 'v' },
            f: { x: cx - sw/2, y: cy - sh/2, type: 'v' },
            g: { x: cx - sw/2, y: cy - t/2, type: 'h' },
        };

        // Custom draw functions for better looking segments
        const drawSeg = (key, active) => {
             ctx.fillStyle = active === LV.HIGH ? "#ef4444" : "#280505";
             
             if (key === 'dp') {
                 ctx.beginPath();
                 ctx.arc(cx + sw/2 + 10, cy + sh/2 - 5, 3, 0, Math.PI*2);
                 ctx.fill();
                 return;
             }

             const x = segs[key].x;
             const y = segs[key].y;
             
             // Simple rectangles for robustness
             if (key === 'a') ctx.fillRect(x, y, sw, t);
             if (key === 'b') ctx.fillRect(x, y, t, sh/2);
             if (key === 'c') ctx.fillRect(x, y, t, sh/2);
             if (key === 'd') ctx.fillRect(x, y, sw, t);
             if (key === 'e') ctx.fillRect(x, y, t, sh/2);
             if (key === 'f') ctx.fillRect(x, y, t, sh/2);
             if (key === 'g') ctx.fillRect(x, y, sw, t);
        };

        ['a','b','c','d','e','f','g', 'dp'].forEach(k => drawSeg(k, getVal(k)));


        // Pins
        for (const p of c.pins) {
          const pos = pinPosition(c, p);
          
          ctx.font = "9px system-ui";
          ctx.fillStyle = "#888";
          ctx.textAlign = "left";
          ctx.fillText(p.name, pos.x + 8, pos.y + 3);

          const isHovered = hoveredPin?.pin?.id === p.id;
          if (isHovered) {
             ctx.save();
             ctx.globalAlpha = 0.5;
             ctx.beginPath();
             ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
             ctx.fillStyle = "#60a5fa";
             ctx.fill();
             ctx.restore();
          }
          pinDot(ctx, pos.x, pos.y, p.value);
        }
        ctx.textAlign = "left";
        ctx.restore();
        continue;
      }

      // Draw logic gates with proper shapes
      const isLogicGate = [KIND.AND, KIND.OR, KIND.NOT, KIND.XOR, KIND.NAND, KIND.NOR, KIND.XNOR].includes(c.kind);

      if (isLogicGate) {
        // Draw gate shape
        ctx.fillStyle = "#121212";
        ctx.strokeStyle = isSel ? "#FAD90E" : "#333";
        ctx.lineWidth = isSel ? 3 : 2;

        const gateX = c.x + 10;
        const gateY = c.y + 5;
        const gateW = c.w - 20;
        const gateH = c.h - 10;

        if (c.kind === KIND.AND || c.kind === KIND.NAND) {
          drawAndGate(ctx, gateX, gateY, gateW, gateH);
        } else if (c.kind === KIND.OR || c.kind === KIND.NOR) {
          drawOrGate(ctx, gateX, gateY, gateW, gateH);
        } else if (c.kind === KIND.XOR || c.kind === KIND.XNOR) {
          drawXorGate(ctx, gateX, gateY, gateW, gateH);
        } else if (c.kind === KIND.NOT) {
          drawNotGate(ctx, gateX, gateY, gateW, gateH);
        }

        ctx.fill();
        ctx.stroke();

        // Draw inverter bubble for NOT, NAND, NOR, XNOR gates
        if (c.kind === KIND.NOT) {
          ctx.fillStyle = "#121212";
          drawInverterBubble(ctx, gateX + gateW + -5, gateY + gateH / 2, 7);
        } else if (c.kind === KIND.NOR || c.kind === KIND.XNOR) {
          ctx.fillStyle = "#121212";
          drawInverterBubble(ctx, gateX + gateW + 0, gateY + gateH / 2, 7);
        } else if (c.kind === KIND.NAND) {
          ctx.fillStyle = "#121212";
          drawInverterBubble(ctx, gateX + gateW + -15, gateY + gateH / 2, 7);
        }

        // Draw gate label
        ctx.fillStyle = "#e5e5e5";
        ctx.font = "12px system-ui";
        ctx.textAlign = "center";
        drawStraightText(ctx, c.kind, c.x + c.w / 2, c.y + c.h - 8, c);
        ctx.textAlign = "left"; // Reset to default
      } else {
        // Draw INPUT and LED as boxes
        // Skip box drawing for GND and VCC for a cleaner look
        const isSupply = c.kind === KIND.GND || c.kind === KIND.VCC;

        if (!isSupply) {
            ctx.fillStyle = "#121212";
            ctx.strokeStyle = isSel ? "#FAD90E" : "#333";
            ctx.lineWidth = isSel ? 3 : 2;

            roundRect(ctx, c.x, c.y, c.w, c.h, 12);
            ctx.fill();
            ctx.stroke();

            // title
            ctx.fillStyle = "#e5e5e5";
            ctx.font = "14px system-ui";
            drawStraightText(ctx, c.kind, c.x + 12, c.y + 22, c);
        }

        if (c.kind === KIND.VCC) {
          ctx.fillStyle = isSel ? "#FAD90E" : "#ef4444"; // Highlight if selected
          ctx.font = "bold 20px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("VCC", c.x + c.w / 2, c.y + c.h / 2);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";

          // Draw small vertical line to pin
          ctx.strokeStyle = isSel ? "#FAD90E" : "#ef4444";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(c.x + c.w / 2, c.y + c.h / 2 + 12);
          ctx.lineTo(c.x + c.w / 2, c.y + c.h);
          ctx.stroke();
        }

        if (c.kind === KIND.GND) {
          // Draw GND symbol (three horizontal lines)
          ctx.strokeStyle = isSel ? "#FAD90E" : "#9ca3af";
          ctx.lineWidth = 2;
          const centerX = c.x + c.w / 2;
          const centerY = c.y + c.h / 2;

          // Vertical line from top pin
          ctx.beginPath();
          ctx.moveTo(centerX, c.y);
          ctx.lineTo(centerX, centerY + 5);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(centerX - 12, centerY + 5);
          ctx.lineTo(centerX + 12, centerY + 5);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(centerX - 8, centerY + 10);
          ctx.lineTo(centerX + 8, centerY + 10);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(centerX - 4, centerY + 15);
          ctx.lineTo(centerX + 4, centerY + 15);
          ctx.stroke();
        }
      }

      for (const p of c.pins) {
        const pos = pinPosition(c, p);

        // Check if this pin is hovered
        const isHovered = hoveredPin?.pin?.id === p.id;

        // Draw hover highlight
        if (isHovered) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);

          if (draft) {
            // During draft: show green for valid, red for invalid
            const fromMeta = getPinMeta(draft.fromPinId);
            let isValid = false;

            if (fromMeta) {
              // Valid if directions are opposite (out->in or in->out)
              if (fromMeta.pin.dir === "out" && p.dir === "in") isValid = true;
              if (fromMeta.pin.dir === "in" && p.dir === "out") isValid = true;
            }

            ctx.fillStyle = isValid ? "#10b981" : "#ef4444";
          } else {
            // Not drafting: neutral highlight
            ctx.fillStyle = "#60a5fa";
          }
          ctx.fill();
          ctx.restore();
        }

        pinDot(ctx, pos.x, pos.y, p.value);
      }
      ctx.restore();
    }

    // ---- Draw selection box ----
    if (selectionBox) {
      const { startX, startY, currentX, currentY } = selectionBox;

      // Calculate rectangle (handle any drag direction)
      const left = Math.min(startX, currentX);
      const right = Math.max(startX, currentX);
      const top = Math.min(startY, currentY);
      const bottom = Math.max(startY, currentY);
      const width = right - left;
      const height = bottom - top;

      // Draw semi-transparent fill
      ctx.fillStyle = "rgba(250, 217, 14, 0.1)"; // Yellow with low opacity
      ctx.fillRect(left, top, width, height);

      // Draw border
      ctx.strokeStyle = "#FAD90E"; // Yellow border
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]); // Dashed line
      ctx.strokeRect(left, top, width, height);
      ctx.setLineDash([]); // Reset dash

      // Draw corner handles
      const handleSize = 6;
      ctx.fillStyle = "#FAD90E";
      const corners = [
        [left, top],
        [right, top],
        [left, bottom],
        [right, bottom]
      ];
      corners.forEach(([x, y]) => {
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
      });
    }

    // Status text at bottom
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "12px system-ui";

    const totalSelected = selectedCompIds.length + selectedWireIds.length;
    if (selectionBox) {
      // Show drag selection hint
      ctx.fillText("Drag to select multiple items • Release to finalize selection", 14, rect.height - 14);
    } else if (totalSelected > 0) {
      const compText = selectedCompIds.length > 0 ? `${selectedCompIds.length} component${selectedCompIds.length > 1 ? 's' : ''}` : '';
      const wireText = selectedWireIds.length > 0 ? `${selectedWireIds.length} wire${selectedWireIds.length > 1 ? 's' : ''}` : '';
      const parts = [compText, wireText].filter(Boolean);
      const statusText = `${parts.join(' and ')} selected • Press Delete to remove • Ctrl+A to select all`;
      ctx.fillText(statusText, 14, rect.height - 14);
    } else {
      ctx.fillText(
        "Draft wire: click empty to add point • Backspace removes last point • Click IN pin to finish",
        14,
        rect.height - 14
      );
    }
  };

  React.useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  const toLocal = (e) => {
    const canvas = ref.current;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseMove = (e) => {
    const p = toLocal(e);
    setMouse(p);

    if (selectionBox) {
      // Update selection box as user drags
      setSelectionBox({ ...selectionBox, currentX: p.x, currentY: p.y });
    } else if (drag) {
      const dx = p.x - dragStartRef.current.x;
      const dy = p.y - dragStartRef.current.y;
      if (dx * dx + dy * dy > 4) {
        // 2px movement threshold
        dragMovedRef.current = true;
      }
      // Don't add to history during drag - only preview
      onMoveComponent(drag.compId, p.x - drag.dx, p.y - drag.dy, false);
    } else if (pointDrag) {
      const { wireId, pointIndex, dx, dy } = pointDrag;
      const wire = circuit.wires.find((w) => w.id === wireId);
      if (wire) {
        const newPoints = [...(wire.points || [])];
        // Use raw position for smooth dragging (snap on mouse up)
        newPoints[pointIndex] = { x: p.x - dx, y: p.y - dy };
        // Don't add to history during drag - only preview
        onUpdateWire(wireId, newPoints, false);
      }
    } else {
      // Track hover when not dragging
      const junction = hitJunction(circuit, p.x, p.y);
      if (junction) {
        setHoveredJunction(junction);
        setHoveredPin(null);
        setHoveredComponent(null);
      } else {
        const pin = hitTestPin(circuit, p.x, p.y);
        if (pin) {
          setHoveredPin(pin);
          setHoveredJunction(null);
          setHoveredComponent(null);
        } else {
          setHoveredPin(null);
          setHoveredJunction(null);
          
          const comp = hitComponent(circuit, p.x, p.y);
          setHoveredComponent(comp);
        }
      }
    }
  };

  const getPinMeta = (pinId) => {
    for (const c of circuit.components) {
      const p = c.pins.find((pp) => pp.id === pinId);
      if (p) return { comp: c, pin: p };
    }
    return null;
  };

  // Show toast message
  const showToast = (message) => {
    setToast({ message });
    setTimeout(() => setToast(null), 2000);
  };

  // Wrapper for onConnectPins with validation
  const tryConnectPins = (fromPinId, toPinId, points = []) => {
    const fromMeta = getPinMeta(fromPinId);
    const toMeta = getPinMeta(toPinId);

    if (!fromMeta || !toMeta) return;

    const fromDir = fromMeta.pin.dir;
    const toDir = toMeta.pin.dir;

    // Check if connection is valid
    if (fromDir === toDir) {
      // Invalid: same direction
      if (fromDir === "in") {
        showToast("Invalid connection: IN → IN");
      } else {
        showToast("Invalid connection: OUT → OUT");
      }
      return;
    }

    // Valid connection - proceed
    onConnectPins(fromPinId, toPinId, points);
  };


  const onMouseDown = (e) => {
    closeMenu();

    // Clear hover states when starting drag
    setHoveredPin(null);
    setHoveredJunction(null);

    const { x, y } = toLocal(e);
    dragMovedRef.current = false;
    dragStartRef.current = { x, y };

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    const hitPoint = hitTestWirePoint(circuit, x, y);
    if (hitPoint) {
      const { wireId, pointIndex } = hitPoint;
      const wire = circuit.wires.find((w) => w.id === wireId);
      if (wire) {
        const pt = wire.points[pointIndex];
        setPointDrag({ wireId, pointIndex, dx: x - pt.x, dy: y - pt.y });
        e.preventDefault();
        return;
      }
    }

    const j = hitJunction(circuit, x, y);
    if (j) {
      if (isCtrlOrCmd || isShift) {
        // Multi-select: toggle component in selection
        if (selectedCompIds.includes(j.id)) {
          setSelectedCompIds(selectedCompIds.filter(id => id !== j.id));
        } else {
          setSelectedCompIds([...selectedCompIds, j.id]);
        }
      } else {
        // Single select
        setSelectedCompId(j.id);
        setSelectedWireId(null);
        setSelectedCompIds([]);
        setSelectedWireIds([]);
        setDrag({ compId: j.id, dx: x - j.x, dy: y - j.y });
      }
      e.preventDefault();
      return;
    }

    const hitPin = hitTestPin(circuit, x, y);
    if (hitPin) return;

    const hitW = hitTestWirePolyline(circuit, x, y);
    if (hitW) {
      if (isCtrlOrCmd || isShift) {
        // Multi-select: toggle wire in selection
        if (selectedWireIds.includes(hitW.id)) {
          setSelectedWireIds(selectedWireIds.filter(id => id !== hitW.id));
        } else {
          setSelectedWireIds([...selectedWireIds, hitW.id]);
        }
      } else {
        // Single select
        setSelectedWireId(hitW.id);
        setSelectedCompId(null);
        setSelectedCompIds([]);
        setSelectedWireIds([]);
      }
      e.preventDefault();
      return;
    }

    const hitComp = hitComponent(circuit, x, y);
    if (hitComp) {
      // Handle manual clock pulse (set HIGH on mouse down, will reset on mouse up if no drag)
      if (hitComp.kind === KIND.CLOCK && hitComp.state.mode === "MANUAL") {
        onSetComponentValue(hitComp.id, LV.HIGH);
        // onSetButtonPressed(hitComp.id, true);
        setActiveClockId(hitComp.id);
        // Don't return - allow dragging to work!
      }

      if (hitComp.kind === KIND.BUTTON) {
        // onSetComponentValue(hitComp.id, LV.HIGH);
        // onSetButtonPressed(hitComp.id, false);
        onSetButtonPressed(hitComp.id, true);

        setActiveButtonId(hitComp.id);
      }

      if (isCtrlOrCmd || isShift) {
        // Multi-select: toggle component in selection
        if (selectedCompIds.includes(hitComp.id)) {
          setSelectedCompIds(selectedCompIds.filter(id => id !== hitComp.id));
        } else {
          setSelectedCompIds([...selectedCompIds, hitComp.id]);
        }
      } else {
        // Single select
        setSelectedCompId(hitComp.id);
        setSelectedWireId(null);
        setSelectedCompIds([]);
        setSelectedWireIds([]);
        setDrag({ compId: hitComp.id, dx: x - hitComp.x, dy: y - hitComp.y });
      }
      e.preventDefault();
    } else {
      // Clicked on empty space - start selection box (unless Ctrl/Cmd for multi-select)
      if (!isCtrlOrCmd && !isShift) {
        // Clear selections and start drag select
        setSelectedCompId(null);
        setSelectedWireId(null);
        setSelectedCompIds([]);
        setSelectedWireIds([]);
        setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
      }
    }
  };


  const onMouseUp = (e) => {
    const p = toLocal(e);

    // Finalize selection box
    if (selectionBox) {
      const { startX, startY, currentX, currentY } = selectionBox;

      // Calculate selection rectangle (handle any drag direction)
      const left = Math.min(startX, currentX);
      const right = Math.max(startX, currentX);
      const top = Math.min(startY, currentY);
      const bottom = Math.max(startY, currentY);

      // Only select if box has some size (not just a click)
      if (Math.abs(currentX - startX) > 5 || Math.abs(currentY - startY) > 5) {
        // Find all components within selection box
        const selectedComps = circuit.components.filter(c => {
          // Check if component's bounding box intersects with selection box
          const compLeft = c.x;
          const compRight = c.x + c.w;
          const compTop = c.y;
          const compBottom = c.y + c.h;

          return !(compRight < left || compLeft > right || compBottom < top || compTop > bottom);
        });

        // Find all wires within selection box
        const selectedWs = circuit.wires.filter(w => {
          const from = findPinPos(circuit, w.fromPinId);
          const to = findPinPos(circuit, w.toPinId);
          if (!from || !to) return false;

          // Check if any point of the wire is within the box
          const wirePoints = buildWirePolyline(from, to, w.points);
          return wirePoints.some(pt =>
            pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom
          );
        });

        setSelectedCompIds(selectedComps.map(c => c.id));
        setSelectedWireIds(selectedWs.map(w => w.id));
        setSelectedCompId(null);
        setSelectedWireId(null);
      }

      setSelectionBox(null);
      return;
    }

    // Reset manual clock pulse
    // - If no drag: Creates a pulse (HIGH then LOW)
    // - If dragged: Reset clock to LOW so it doesn't stay HIGH
    if (activeClockId) {
      onSetComponentValue(activeClockId, LV.LOW);
      setActiveClockId(null);
    }

    // if (activeButtonId) {
    //   onSetComponentValue(activeButtonId, LV.LOW);
    //   setActiveButtonId(null);
    // }
    if (activeButtonId) {
      onSetButtonPressed(activeButtonId, false);
      setActiveButtonId(null);
    }


    // Add component move to history when drag ends
    if (drag && dragMovedRef.current) {
      suppressClickRef.current = true;
      onMoveComponent(drag.compId, p.x - drag.dx, p.y - drag.dy, true);
    }

    // Snap wire point to grid when drag ends and add to history
    if (pointDrag) {
      const { wireId, pointIndex, dx, dy } = pointDrag;
      const wire = circuit.wires.find((w) => w.id === wireId);
      if (wire) {
        const newPoints = [...(wire.points || [])];
        newPoints[pointIndex] = { x: snap(p.x - dx), y: snap(p.y - dy) };
        onUpdateWire(wireId, newPoints, true);
      }
    }

    setDrag(null);
    setWireDrag(null);
    setPointDrag(null);
  };


  const onClick = (e) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (e.button === 2) return;
    closeMenu();

    // Clear hover states on click
    setHoveredPin(null);
    setHoveredJunction(null);

    const { x, y } = toLocal(e);
    const sx = snap(x);
    const sy = snap(y);

    // ✅ 0) Junction click handled FIRST (so it doesn't get confused by hitTestPin)
    const j = hitJunction(circuit, x, y);
    if (j) {
      setSelectedCompId(j.id);
      setSelectedWireId(null);

      const jIn = j.pins[0].id;   // IN
      const jOut = j.pins[1].id;  // OUT

      if (!draft) {
        // start from junction OUT
        setDraft({ fromPinId: jOut, points: [] });
        // Clear multi-select when starting wire draft
        setSelectedCompIds([]);
        setSelectedWireIds([]);
      } else {
        const start = getPinMeta(draft.fromPinId);
        if (!start) {
          setDraft(null);
          return;
        }

        // If draft started from OUT => finish into junction IN
        // If draft started from IN  => finish onto junction OUT (so connectPins can flip)
        const targetPinId = start.pin.dir === "out" ? jIn : jOut;

        tryConnectPins(draft.fromPinId, targetPinId, draft.points);
        setDraft(null);
      }
      return;
    }

    // 1) normal pin click
    const hitPin = hitTestPin(circuit, x, y);
    if (hitPin) {
      setSelectedCompId(hitPin.comp.id);
      setSelectedWireId(null);

      if (!draft) {
        setDraft({ fromPinId: hitPin.pin.id, points: [] });
        // Clear multi-select when starting wire draft
        setSelectedCompIds([]);
        setSelectedWireIds([]);
      } else {
        tryConnectPins(draft.fromPinId, hitPin.pin.id, draft.points);
        setDraft(null);
      }
      return;
    }

    // (keep your existing wire-split draft logic)
    if (draft) {
      const hitW = hitTestWirePolyline(circuit, x, y);
      if (hitW) {
        onSplitWire(hitW.id, { x: sx, y: sy });
        const junction = circuit.components[circuit.components.length - 1];
        tryConnectPins(draft.fromPinId, junction.pins[0].id, draft.points);
        setDraft(null);
        return;
      }
    }

    // 2) if drafting, clicking empty adds a route point
    if (draft) {
      setDraft((prev) => {
        if (!prev) return prev;
        const nextPoints = addOrthoPoint(circuit, prev.fromPinId, prev.points, {
          x: sx,
          y: sy,
        });
        return { ...prev, points: nextPoints };
      });
      return;
    }

    // 3) toggle input
    const hitComp = hitComponent(circuit, x, y);
    if (hitComp?.kind === KIND.INPUT) {
      onToggleInput(hitComp.id);
      return;
    }

    // 4) wire select
    const hitW = hitTestWirePolyline(circuit, x, y);
    if (hitW) {
      setSelectedWireId(hitW.id);
      setSelectedCompId(null);
      return;
    }
  };


  const onContextMenu = (e) => {
    e.preventDefault();
    const { x, y } = toLocal(e);

    // Clear hover states
    setHoveredPin(null);
    setHoveredJunction(null);

    const j = hitJunction(circuit, x, y);
    if (j) {
      setSelectedCompId(j.id);
      setSelectedWireId(null);
      setMenu({ x, y, type: "comp", id: j.id, kind: j.kind });
      return;
    }


    const hitPoint = hitTestWirePoint(circuit, x, y);
    if (hitPoint) {
      setMenu({ x, y, type: "point", ...hitPoint });
      return;
    }

    const hitPin = hitTestPin(circuit, x, y);
    if (hitPin) return;

    const hitW = hitTestWirePolyline(circuit, x, y);
    if (hitW) {
      setSelectedWireId(hitW.id);
      setSelectedCompId(null);
      setMenu({ x, y, type: "wire", id: hitW.id });
      return;
    }

    const hitComp = hitComponent(circuit, x, y);
    if (hitComp) {
      setSelectedCompId(hitComp.id);
      setSelectedWireId(null);
      setMenu({ x, y, type: "comp", id: hitComp.id, kind: hitComp.kind });
      return;
    }

    setMenu({ x, y, type: "blank", id: null });
  };

  // keyboard: delete, cancel, undo point, select all
  React.useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setDraft(null);
        setDrag(null);
        closeMenu();
        // Clear multi-select on Escape
        setSelectedCompIds([]);
        setSelectedWireIds([]);
        return;
      }

      // Ctrl+A / Cmd+A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (!draft) {
          const allCompIds = circuit.components.map(c => c.id);
          const allWireIds = circuit.wires.map(w => w.id);
          setSelectedCompIds(allCompIds);
          setSelectedWireIds(allWireIds);
          setSelectedCompId(null);
          setSelectedWireId(null);
        }
        return;
      }

      // while drafting: Backspace removes last point
      if (draft && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        setDraft((prev) => {
          if (!prev) return prev;
          const pts = prev.points.slice(0, -1);
          return { ...prev, points: pts };
        });
        return;
      }

      // not drafting: delete selection (single or multiple)
      if (!draft && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();

        // Combine single selection with multi-selection
        const allCompIds = [...selectedCompIds];
        const allWireIds = [...selectedWireIds];

        // Add single selections if they exist and aren't already in arrays
        if (selectedCompId && !allCompIds.includes(selectedCompId)) {
          allCompIds.push(selectedCompId);
        }
        if (selectedWireId && !allWireIds.includes(selectedWireId)) {
          allWireIds.push(selectedWireId);
        }

        // Delete if there's anything selected
        if (allCompIds.length > 0 || allWireIds.length > 0) {
          onDeleteMultiple(allCompIds, allWireIds);

          // Clear all selections
          setSelectedCompIds([]);
          setSelectedWireIds([]);
          setSelectedCompId(null);
          setSelectedWireId(null);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draft, selectedCompId, selectedWireId, selectedCompIds, selectedWireIds, onDeleteComponent, onDeleteWire, onDeleteMultiple, circuit]);

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={ref}
        style={{
            cursor: drag || pointDrag 
                ? "grabbing" 
                : (hoveredComponent || hoveredPin || hoveredJunction) 
                    ? "pointer" 
                    : "crosshair"
        }}
        className="w-full h-full"
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onClick={onClick}
        onContextMenu={onContextMenu}
      />

      {menu && (
        <div
          className="absolute z-50 rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl text-sm overflow-hidden"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {menu.type === "comp" && (
            <div className="min-w-44">
              {menu.kind === KIND.CLOCK && (
                <button
                  className="w-full text-left px-3 py-2 hover:bg-neutral-800"
                  onClick={() => {
                    onToggleClockMode(menu.id);
                    closeMenu();
                  }}
                >
                  {circuit.components.find((c) => c.id === menu.id)?.state
                    .mode === "AUTO"
                    ? "Set to Manual"
                    : "Set to Auto"}
                </button>
              )}
              {menu.kind !== KIND.JUNCTION && (
                <button
                  className="w-full text-left px-3 py-2 hover:bg-neutral-800"
                  onClick={() => {
                    onDuplicateComponent(menu.id);
                    closeMenu();
                  }}
                >
                  Duplicate
                </button>
              )}
              <button
                className="w-full text-left px-3 py-2 hover:bg-neutral-800 text-red-300"
                onClick={() => {
                  onDeleteComponent(menu.id);
                  closeMenu();
                }}
              >
                {menu.kind === KIND.JUNCTION ? "Delete junction" : "Delete"}

              </button>
            </div>
          )}

          {menu.type === "wire" && (
            <div className="min-w-44">
              <button
                className="w-full text-left px-3 py-2 hover:bg-neutral-800"
                onClick={() => {
                  const wire = circuit.wires.find((w) => w.id === menu.id);
                  if (wire) {
                    const from = findPinPos(circuit, wire.fromPinId);
                    const to = findPinPos(circuit, wire.toPinId);
                    const pts = buildWirePolyline(from, to, wire.points);
                    const { pt, t } = closestPointOnPolyline({ x: menu.x, y: menu.y }, pts);

                    const snapped = { x: snap(pt.x), y: snap(pt.y) };
                    const newPoints = [...(wire.points || [])];

                    // Insert point at correct position based on where we clicked
                    // t represents position along polyline: 0=start, pts.length-1=end
                    // Since pts includes from and to pins, we need to subtract 1 for the insert index
                    const insertIndex = Math.max(0, Math.min(newPoints.length, Math.floor(t)));
                    newPoints.splice(insertIndex, 0, snapped);

                    onUpdateWire(wire.id, newPoints);
                  }
                  closeMenu();
                }}
              >
                Add point
              </button>

              <button
                className="w-full text-left px-3 py-2 hover:bg-neutral-800"
                onClick={() => {
                  const wire = circuit.wires.find((w) => w.id === menu.id);
                  if (!wire) return;

                  // ✅ use closest point ON the wire, not where user clicked near it
                  const from = findPinPos(circuit, wire.fromPinId);
                  const to = findPinPos(circuit, wire.toPinId);
                  const pts = buildWirePolyline(from, to, wire.points);
                  const { pt } = closestPointOnPolyline({ x: menu.x, y: menu.y }, pts);

                  const snapped = { x: snap(pt.x), y: snap(pt.y) };
                  const newPinId = onSplitWireAndStartDraft(menu.id, snapped);

                  setDraft({ fromPinId: newPinId, points: [] });
                  closeMenu();
                }}
              >
                Connect from here
              </button>

              <button
                className="w-full text-left px-3 py-2 hover:bg-neutral-800 text-red-300"
                onClick={() => {
                  onDeleteWire(menu.id);
                  closeMenu();
                }}
              >
                Delete wire
              </button>
            </div>
          )}

          {menu.type === "point" && (
            <div className="min-w-44">
              <button
                className="w-full text-left px-3 py-2 hover:bg-neutral-800"
                onClick={() => {
                  const newPinId = onSplitWireAndStartDraft(menu.wireId, {
                    x: snap(menu.x),
                    y: snap(menu.y),
                  });
                  setDraft({ fromPinId: newPinId, points: [] });
                  closeMenu();
                }}
              >
                Connect from here
              </button>

              <button
                className="w-full text-left px-3 py-2 hover:bg-neutral-800 text-red-300"
                onClick={() => {
                  const { wireId, pointIndex } = menu;
                  const wire = circuit.wires.find((w) => w.id === wireId);
                  if (wire) {
                    const newPoints = [...(wire.points || [])];
                    newPoints.splice(pointIndex, 1);
                    onUpdateWire(wireId, newPoints);
                  }
                  closeMenu();
                }}
              >
                Delete point
              </button>
            </div>
          )}

          {/* {menu.type === "blank" && (
            <div className="min-w-44">
              <div className="px-3 py-2 text-neutral-400">No actions</div>
            </div>
          )} */}

          {menu.type === "blank" && (
            <div className="min-w-44">
              <button
                className="w-full text-left px-3 py-2 hover:bg-neutral-800"
                onClick={() => {
                  // Center junction (20x20) at clicked position
                  onPlace(snap(menu.x) - 10, snap(menu.y) - 10, KIND.JUNCTION);
                  closeMenu();
                }}
              >
                Add junction here
              </button>
            </div>
          )}

        </div>
      )}

      {/* Toast notification for invalid connections */}
      {toast && (
        <div
          className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
          style={{
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function findPin(circuit, pinId) {
  for (const c of circuit.components) {
    const p = c.pins.find((pp) => pp.id === pinId);
    if (p) return { comp: c, pin: p };
  }
  return null;
}
function hitComponent(circuit, x, y) {
  for (let i = circuit.components.length - 1; i >= 0; i--) {
    const c = circuit.components[i];
    
    let testX = x;
    let testY = y;

    if (c.rotate) {
         const cx = c.x + c.w / 2;
         const cy = c.y + c.h / 2;
         const rad = -(c.rotate * 90 * Math.PI) / 180; // Negative for inverse rotation
         
         const dx = x - cx;
         const dy = y - cy;
         
         testX = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
         testY = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
    }

    if (testX >= c.x && testX <= c.x + c.w && testY >= c.y && testY <= c.y + c.h) return c;
  }
  return null;
}

function buildWirePolyline(from, to, points) {
  const mid = Array.isArray(points) ? points : [];
  return [from, ...mid, to];
}

function buildDraftPolyline(from, points, end) {
  const pts = [from, ...(points || [])];
  // Draw straight line from last point to mouse cursor
  return [...pts, end];
}

function addOrthoPoint(circuit, fromPinId, points, clicked) {
  const from = findPinPos(circuit, fromPinId);
  if (!from) return points;

  // Just add the clicked point directly (no L-shape routing)
  const out = [...(points || [])];
  const prev = out[out.length - 1];

  // Only add if it's not a duplicate of the last point
  if (!prev || prev.x !== clicked.x || prev.y !== clicked.y) {
    out.push(clicked);
  }

  return out;
}

function orthoSegment(a, b) {
  if (a.x === b.x || a.y === b.y) return [a, b];
  return [a, { x: b.x, y: a.y }, b];
}

function drawPolyline(ctx, pts) {
  if (!pts || pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function hitTestWirePolyline(circuit, x, y) {
  for (let i = circuit.wires.length - 1; i >= 0; i--) {
    const w = circuit.wires[i];
    const from = findPinPos(circuit, w.fromPinId);
    const to = findPinPos(circuit, w.toPinId);
    if (!from || !to) continue;

    const pts = buildWirePolyline(from, to, w.points);
    const d = distPointToPolyline({ x, y }, pts);
    if (d <= WIRE_HIT_PX) return w;
  }
  return null;
}

function hitTestWirePoint(circuit, x, y) {
  for (const w of circuit.wires) {
    if (!w.points) continue;
    for (let i = 0; i < w.points.length; i++) {
      const p = w.points[i];
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy < PIN_RADIUS * PIN_RADIUS) {
        return { wireId: w.id, pointIndex: i };
      }
    }
  }
  return null;
}

function closestPointOnPolyline(p, pts) {
  let best = { t: 0, pt: pts[0], d: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;

    const ab2 = abx * abx + aby * aby;
    if (ab2 === 0) {
      const d = Math.hypot(apx, apy);
      if (d < best.d) best = { t: i, pt: a, d };
      continue;
    }

    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));

    const cx = a.x + t * abx;
    const cy = a.y + t * aby;
    const d = Math.hypot(p.x - cx, p.y - cy);

    if (d < best.d) best = { t: i + t, pt: { x: cx, y: cy }, d };
  }
  return best;
}

function distPointToPolyline(p, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    best = Math.min(best, distPointToSegment(p, pts[i], pts[i + 1]));
  }
  return best;
}

function distPointToSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;

  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return Math.hypot(apx, apy);

  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));

  const cx = a.x + t * abx;
  const cy = a.y + t * aby;
  return Math.hypot(p.x - cx, p.y - cy);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStraightText(ctx, text, x, y, c) {
    if (!c.rotate) {
        ctx.fillText(text, x, y);
        return;
    }
    ctx.save();
    ctx.translate(x, y);
    // Counter-rotate to keep text horizontal
    ctx.rotate(-(c.rotate * 90 * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
    ctx.restore();
}

function pinPosition(c, p) {
    const pos = basePinPosition(c, p);
    if (!c.rotate) return pos;

    // Rotate around center
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const rad = (c.rotate * 90 * Math.PI) / 180;
    
    const dx = pos.x - cx;
    const dy = pos.y - cy;

    return {
        x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
    };
}

function basePinPosition(c, p) {
  // ✅ Junction pins meet exactly at the node center
  if (c.kind === KIND.JUNCTION) {
    return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
  }

  // ✅ MUX/DEMUX: Selectors at bottom, others on sides
  if (c.kind === KIND.MUX || c.kind === KIND.DEMUX) {
    if (p.name.startsWith("S")) {
      const selects = c.pins.filter((pp) => pp.name.startsWith("S"));
      const idx = selects.findIndex((pp) => pp.id === p.id);
      const count = selects.length;
      // Distribute evenly along bottom edge, MSB on left
      const step = c.w / (count + 1);
      return { x: c.x + step * (count - idx), y: c.y + c.h };
    } else {
      // Side pins (I0..In or Y0..Yn)
      // Filter out selector pins to get correct vertical distribution
      const sidePins = c.pins.filter((pp) => pp.dir === p.dir && !pp.name.startsWith("S"));
      const idx = sidePins.findIndex((pp) => pp.id === p.id);
      const gap = c.h / (sidePins.length + 1);
      const x = p.dir === "in" ? c.x : c.x + c.w;
      return { x, y: c.y + gap * (idx + 1) };
    }
  }

  // ✅ INPUT: Pin closer to switch
  if (c.kind === KIND.INPUT) {
    return { x: c.x + 54, y: c.y + 30 };
  }

  // ✅ BUTTON: Pin closer to circle
  if (c.kind === KIND.BUTTON) {
    return { x: c.x + 50, y: c.y + 30 };
  }

  // ✅ LED: Pin on left
  if (c.kind === KIND.LED) {
    return { x: c.x + 6, y: c.y + 30 };
  }

  // ✅ VCC: Pin on bottom
  if (c.kind === KIND.VCC) {
    return { x: c.x + c.w / 2, y: c.y + c.h };
  }

  // ✅ GND: Pin on top
  if (c.kind === KIND.GND) {
    return { x: c.x + c.w / 2, y: c.y };
  }

  // ✅ FF PRE/CLR: Top/Bottom Center
  if ((c.kind === KIND.D_FF || c.kind === KIND.JK_FF || c.kind === KIND.T_FF) && (p.name === "PRE" || p.name === "CLR")) {
    if (p.name === "PRE") return { x: c.x + c.w / 2, y: c.y };
    if (p.name === "CLR") return { x: c.x + c.w / 2, y: c.y + c.h };
  }

  // Logic gates have insets, adjust pin positions
  const isLogicGate = [KIND.AND, KIND.OR, KIND.NOT, KIND.XOR, KIND.NAND, KIND.NOR, KIND.XNOR].includes(c.kind);

  if (isLogicGate) {
    if (p.dir === "out") {
      // Output pin - different offset for each gate type
      let outputOffset = 0;

      if (c.kind === KIND.AND) {
        outputOffset = 20; // Distance from box edge to AND gate output pin
      } else if (c.kind === KIND.OR) {
        outputOffset = 1; // Distance from box edge to OR gate output pin
      } else if (c.kind === KIND.XOR) {
        outputOffset = 1; // Distance from box edge to XOR gate output pin
      } else if (c.kind === KIND.NOT) {
        outputOffset = -2; // Distance from box edge to NOT gate output pin (includes bubble)
      } else if (c.kind === KIND.NAND) {
        outputOffset = 10; // Distance from box edge to NAND gate output pin (includes bubble)
      } else if (c.kind === KIND.NOR) {
        outputOffset = -4; // Distance from box edge to NOR gate output pin (includes bubble)
      } else if (c.kind === KIND.XNOR) {
        outputOffset = -4; // Distance from box edge to XNOR gate output pin (includes bubble)
      }

      return { x: c.x + c.w - outputOffset, y: c.y + c.h / 2 };
    } else {
      // Input pins - different offset for each gate type
      const ins = c.pins.filter((pp) => pp.dir === "in");
      const idx = ins.findIndex((pp) => pp.id === p.id);
      const gap = c.h / (ins.length + 1);

      let inputOffset = 0;

      if (c.kind === KIND.AND || c.kind === KIND.NAND) {
        inputOffset = 0; // Distance from box edge to AND/NAND gate input pins
      } else if (c.kind === KIND.OR || c.kind === KIND.NOR) {
        inputOffset = 5; // Distance from box edge to OR/NOR gate input pins (curved back)
      } else if (c.kind === KIND.XOR || c.kind === KIND.XNOR) {
        inputOffset = 0; // Distance from box edge to XOR/XNOR gate input pins (curved back)
      } else if (c.kind === KIND.NOT) {
        inputOffset = 0; // Distance from box edge to NOT gate input pin
      }

      return { x: c.x + inputOffset, y: c.y + gap * (idx + 1) };
    }
  }

  // ✅ NEW: explicit pin side support (top/bottom/left/right)
  if (p.side) {
    const group = c.pins.filter(pp => (pp.side || null) === p.side);
    const idx = group.findIndex(pp => pp.id === p.id);
    const count = group.length;

    // Dynamically adjust pad based on pin count to prevent crowding
    const pad = count > 5 ? 6 : 18; 
    const t = (idx + 1) / (count + 1);

    if (p.side === "left") {
      return { x: c.x, y: c.y + pad + (c.h - pad * 2) * t };
    }
    if (p.side === "right") {
      return { x: c.x + c.w, y: c.y + pad + (c.h - pad * 2) * t };
    }
    if (p.side === "top") {
      return { x: c.x + pad + (c.w - pad * 2) * t, y: c.y };
    }
    if (p.side === "bottom") {
      return { x: c.x + pad + (c.w - pad * 2) * t, y: c.y + c.h };
    }
  }

  // Non-logic gates (INPUT, LED) use box edges
  if (p.dir === "out") {
    const outs = c.pins.filter((pp) => pp.dir === "out");
    if (outs.length === 1) return { x: c.x + c.w, y: c.y + c.h / 2 };

    const idx = outs.findIndex((pp) => pp.id === p.id);
    const gap = c.h / (outs.length + 1);
    return { x: c.x + c.w, y: c.y + gap * (idx + 1) };
  }

  let ins = c.pins.filter((pp) => pp.dir === "in");

  // ✅ Fix for Flip-Flops: Exclude special pins from side distribution
  if (c.kind === KIND.D_FF || c.kind === KIND.JK_FF || c.kind === KIND.SR_LATCH || c.kind === KIND.T_FF) {
    ins = ins.filter(pp => pp.name !== "PRE" && pp.name !== "CLR");
  }

  const idx = ins.findIndex((pp) => pp.id === p.id);
  const gap = c.h / (ins.length + 1);
  return { x: c.x, y: c.y + gap * (idx + 1) };
}


function hitJunction(circuit, x, y) {
  for (let i = circuit.components.length - 1; i >= 0; i--) {
    const c = circuit.components[i];
    if (c.kind !== KIND.JUNCTION) continue;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= 14 * 14) return c; // 14px radius hit area
  }
  return null;
}

function findPinPos(circuit, pinId) {
  for (const c of circuit.components) {
    for (const p of c.pins) {
      if (p.id === pinId) return pinPosition(c, p);
    }
  }
  return null;
}

function hitTestPin(circuit, x, y) {
  for (const c of circuit.components) {
    for (const p of c.pins) {
      const pos = pinPosition(c, p);
      const dx = x - pos.x;
      const dy = y - pos.y;
      if (dx * dx + dy * dy <= PIN_RADIUS * PIN_RADIUS) {
        return { comp: c, pin: p, x: pos.x, y: pos.y };
      }
    }
  }
  return null;
}



