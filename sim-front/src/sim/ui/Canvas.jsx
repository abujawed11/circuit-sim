import React, { useRef, useState } from "react";
import { KIND, LV } from "../model/types";

const PIN_RADIUS = 8;

const pinDot = (ctx, x, y, v) => {
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = v === LV.HIGH ? "#FAD90E" : v === LV.LOW ? "#555" : "#9CA3AF";
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.stroke();
};

export default function Canvas({ circuit, onPlace, onToggleInput, onConnectPins }) {
  const ref = useRef(null);

  // NEW: wire draft state
  const [draft, setDraft] = useState(null); // { fromPinId, fromX, fromY }
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

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
    for (let x = 0; x < rect.width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // wires
    ctx.strokeStyle = "#9CA3AF";
    ctx.lineWidth = 3;
    for (const w of circuit.wires) {
      const from = findPinPos(circuit, w.fromPinId);
      const to = findPinPos(circuit, w.toPinId);
      if (!from || !to) continue;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    // NEW: preview wire while drafting
    if (draft) {
      ctx.strokeStyle = "#FAD90E";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(draft.fromX, draft.fromY);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // components
    for (const c of circuit.components) {
      // body
      ctx.fillStyle = "#121212";
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
      roundRect(ctx, c.x, c.y, c.w, c.h, 12);
      ctx.fill();
      ctx.stroke();

      // title
      ctx.fillStyle = "#e5e5e5";
      ctx.font = "14px system-ui";
      ctx.fillText(c.kind, c.x + 12, c.y + 22);

      // input state indicator
      if (c.kind === KIND.INPUT) {
        ctx.fillStyle = c.state.value === LV.HIGH ? "#FAD90E" : "#666";
        ctx.beginPath();
        ctx.arc(c.x + c.w - 18, c.y + 18, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // LED glow
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

      // pins
      for (const p of c.pins) {
        const pos = pinPosition(c, p);
        pinDot(ctx, pos.x, pos.y, p.value);
      }
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
  };

  const onClick = (e) => {
    const { x, y } = toLocal(e);

    // 1) If clicked on a pin -> wiring logic
    const hitPin = hitTestPin(circuit, x, y);
    if (hitPin) {
      if (!draft) {
        // start wire only from OUT pins
        if (hitPin.pin.dir === "out") {
          setDraft({ fromPinId: hitPin.pin.id, fromX: hitPin.x, fromY: hitPin.y });
        }
      } else {
        // finish wire only to IN pins
        if (hitPin.pin.dir === "in") {
          onConnectPins(draft.fromPinId, hitPin.pin.id);
          setDraft(null);
        }
      }
      return;
    }

    // 2) If drafting and clicked empty -> cancel draft
    if (draft) {
      setDraft(null);
      return;
    }

    // 3) If click on INPUT body -> toggle
    const hitComp = circuit.components.find(
      (c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h
    );
    if (hitComp?.kind === KIND.INPUT) {
      onToggleInput(hitComp.id);
      return;
    }

    // 4) Otherwise place component
    onPlace(x - 60, y - 35);
  };

  return (
    <canvas
      ref={ref}
      className="w-full h-full cursor-crosshair"
      onMouseMove={onMouseMove}
      onClick={onClick}
    />
  );
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
  if (p.dir === "out") return { x: c.x + c.w, y: c.y + c.h / 2 };

  const ins = c.pins.filter((pp) => pp.dir === "in");
  const idx = ins.findIndex((pp) => pp.id === p.id);
  const gap = c.h / (ins.length + 1);
  return { x: c.x, y: c.y + gap * (idx + 1) };
}

function findPinPos(circuit, pinId) {
  for (const c of circuit.components) {
    for (const p of c.pins) {
      if (p.id === pinId) return pinPosition(c, p);
    }
  }
  return null;
}

// NEW: hit test pins by distance
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
