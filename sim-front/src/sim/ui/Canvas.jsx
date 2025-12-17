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
  const [menu, setMenu] = useState(null);
  const closeMenu = () => setMenu(null);

  // Hover states for UX feedback
  const [hoveredPin, setHoveredPin] = useState(null); // { comp, pin, x, y }
  const [hoveredJunction, setHoveredJunction] = useState(null); // component object
  const [toast, setToast] = useState(null); // { message }

  const dragMovedRef = React.useRef(false);
  const suppressClickRef = React.useRef(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });

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
        // visual indicator of clock state
        ctx.fillStyle = v === LV.HIGH ? "#10b981" : "#333";
        ctx.beginPath();
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 10, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = "#e5e5e5";
        ctx.font = "12px system-ui";
        ctx.fillText("CLK", c.x + 12, c.y + 18);

        // Draw pin
        for (const p of c.pins) {
          const pos = pinPosition(c, p);
          pinDot(ctx, pos.x, pos.y, p.value);
        }
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
        ctx.fillText(c.kind, c.x + c.w / 2, c.y + c.h - 8);
        ctx.textAlign = "left"; // Reset to default
      } else {
        // Draw INPUT and LED as boxes
        ctx.fillStyle = "#121212";
        ctx.strokeStyle = isSel ? "#FAD90E" : "#333";
        ctx.lineWidth = isSel ? 3 : 2;

        roundRect(ctx, c.x, c.y, c.w, c.h, 12);
        ctx.fill();
        ctx.stroke();

        // title
        ctx.fillStyle = "#e5e5e5";
        ctx.font = "14px system-ui";
        ctx.fillText(c.kind, c.x + 12, c.y + 22);

        if (c.kind === KIND.INPUT) {
          ctx.fillStyle = c.state.value === LV.HIGH ? "#10b981" : "#666";
          ctx.beginPath();
          ctx.arc(c.x + c.w - 18, c.y + 18, 8, 0, Math.PI * 2);
          ctx.fill();
        }

        if (c.kind === KIND.LED) {
          const inPin = c.pins.find((p) => p.name === "IN");
          const on = inPin?.value === LV.HIGH;
          ctx.fillStyle = on ? "rgba(250,217,14,0.25)" : "rgba(255,255,255,0.04)";
          roundRect(ctx, c.x + 8, c.y + 30, c.w - 16, c.h - 38, 10);
          ctx.fill();

          ctx.fillStyle = on ? "#FAD90E" : "#777";
          ctx.font = "12px system-ui";
          ctx.fillText(on ? "ON" : "OFF", c.x + 12, c.y + c.h - 12);
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
    }

    // Status text at bottom
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "12px system-ui";

    const totalSelected = selectedCompIds.length + selectedWireIds.length;
    if (totalSelected > 0) {
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

    if (drag) {
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
      } else {
        const pin = hitTestPin(circuit, p.x, p.y);
        if (pin) {
          setHoveredPin(pin);
          setHoveredJunction(null);
        } else {
          setHoveredPin(null);
          setHoveredJunction(null);
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
      // Clicked on empty space - clear all selections
      setSelectedCompId(null);
      setSelectedWireId(null);
      setSelectedCompIds([]);
      setSelectedWireIds([]);
    }
  };


  const onMouseUp = (e) => {
    const p = toLocal(e);

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
        className="w-full h-full cursor-crosshair"
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
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
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

function pinPosition(c, p) {
  // ✅ Junction pins meet exactly at the node center
  if (c.kind === KIND.JUNCTION) {
    return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
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

  // Non-logic gates (INPUT, LED) use box edges
  if (p.dir === "out") return { x: c.x + c.w, y: c.y + c.h / 2 };

  const ins = c.pins.filter((pp) => pp.dir === "in");
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



