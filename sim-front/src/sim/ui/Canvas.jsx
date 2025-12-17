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

export default function Canvas({
  circuit,
  onPlace,
  onToggleInput,
  onConnectPins,
  onMoveComponent,
  onDeleteComponent,
  onDuplicateComponent,
  onDeleteWire,
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

  const [drag, setDrag] = useState(null); // { compId, dx, dy }
  const [wireDrag, setWireDrag] = useState(null); // { wireId, dx, dy }
  const [pointDrag, setPointDrag] = useState(null); // { wireId, pointIndex, dx, dy }
  const [menu, setMenu] = useState(null);
  const closeMenu = () => setMenu(null);

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

      const isSel = w.id === selectedWireId;

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

        const previewEnd = { x: snap(mouse.x), y: snap(mouse.y) };
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
      const isSel = c.id === selectedCompId;

      ctx.fillStyle = "#121212";
      ctx.strokeStyle = isSel ? "#FAD90E" : "#333";
      ctx.lineWidth = isSel ? 3 : 2;

      roundRect(ctx, c.x, c.y, c.w, c.h, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#e5e5e5";
      ctx.font = "14px system-ui";
      ctx.fillText(c.kind, c.x + 12, c.y + 22);

      if (c.kind === KIND.INPUT) {
        ctx.fillStyle = c.state.value === LV.HIGH ? "#FAD90E" : "#666";
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

      for (const p of c.pins) {
        const pos = pinPosition(c, p);
        pinDot(ctx, pos.x, pos.y, p.value);
      }
    }

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "12px system-ui";
    ctx.fillText(
      "Draft wire: click empty to add point • Backspace removes last point • Click IN pin to finish",
      14,
      rect.height - 14
    );
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
      onMoveComponent(drag.compId, p.x - drag.dx, p.y - drag.dy);
    } else if (pointDrag) {
      const { wireId, pointIndex, dx, dy } = pointDrag;
      const wire = circuit.wires.find((w) => w.id === wireId);
      if (wire) {
        const newPoints = [...(wire.points || [])];
        newPoints[pointIndex] = { x: snap(p.x - dx), y: snap(p.y - dy) };
        onUpdateWire(wireId, newPoints);
      }
    }
  };

  const onMouseDown = (e) => {
    closeMenu();
    const { x, y } = toLocal(e);

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

    const hitPin = hitTestPin(circuit, x, y);
    if (hitPin) return;

    const hitW = hitTestWirePolyline(circuit, x, y);
    if (hitW) {
      setSelectedWireId(hitW.id);
      setSelectedCompId(null);
      e.preventDefault();
      return;
    }

    const hitComp = hitComponent(circuit, x, y);
    if (hitComp) {
      setSelectedCompId(hitComp.id);
      setSelectedWireId(null);
      setDrag({ compId: hitComp.id, dx: x - hitComp.x, dy: y - hitComp.y });
      e.preventDefault();
    } else {
      setSelectedCompId(null);
      setSelectedWireId(null);
    }
  };

  const onMouseUp = () => {
    setDrag(null);
    setWireDrag(null);
    setPointDrag(null);
  };

  const onClick = (e) => {
    closeMenu();
    const { x, y } = toLocal(e);
    const sx = snap(x);
    const sy = snap(y);

    // 1) pin click (wiring start/finish)
    const hitPin = hitTestPin(circuit, x, y);
    if (hitPin) {
      setSelectedCompId(hitPin.comp.id);
      setSelectedWireId(null);

      if (!draft) {
        setDraft({ fromPinId: hitPin.pin.id, points: [] });
      } else {
        onConnectPins(draft.fromPinId, hitPin.pin.id, draft.points);
        setDraft(null);
      }
      return;
    }

    if (draft) {
      const hitW = hitTestWirePolyline(circuit, x, y);
      if (hitW) {
        onSplitWire(hitW.id, { x: sx, y: sy });
        const junction = circuit.components[circuit.components.length - 1];
        onConnectPins(draft.fromPinId, junction.pins[0].id, draft.points);
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
      setMenu({ x, y, type: "comp", id: hitComp.id });
      return;
    }

    setMenu({ x, y, type: "blank", id: null });
  };

  // keyboard: delete, cancel, undo point
  React.useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setDraft(null);
        setDrag(null);
        closeMenu();
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

      // not drafting: delete selection
      if (!draft && (e.key === "Backspace" || e.key === "Delete")) {
        if (selectedWireId) {
          onDeleteWire(selectedWireId);
          setSelectedWireId(null);
          return;
        }
        if (selectedCompId) {
          onDeleteComponent(selectedCompId);
          setSelectedCompId(null);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draft, selectedCompId, selectedWireId, onDeleteComponent, onDeleteWire]);

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
              <button
                className="w-full text-left px-3 py-2 hover:bg-neutral-800"
                onClick={() => {
                  onDuplicateComponent(menu.id);
                  closeMenu();
                }}
              >
                Duplicate
              </button>
              <button
                className="w-full text-left px-3 py-2 hover:bg-neutral-800 text-red-300"
                onClick={() => {
                  onDeleteComponent(menu.id);
                  closeMenu();
                }}
              >
                Delete
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
                    const { pt } = closestPointOnPolyline(
                      { x: menu.x, y: menu.y },
                      pts
                    );
                    const newPoints = [...(wire.points || [])];
                    newPoints.push(pt);
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
                  const newPinId = onSplitWireAndStartDraft(menu.id, {
                    x: menu.x,
                    y: menu.y,
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
                  const newPinId = onSplitWireAndStartDraft(menu.wireId, menu);
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

          {menu.type === "blank" && (
            <div className="min-w-44">
              <div className="px-3 py-2 text-neutral-400">No actions</div>
            </div>
          )}
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
  // If old wires exist without points, this still works
  return [from, ...mid, to];
}

// For draft we want ortho segments (Manhattan). We enforce it when adding points,
// but also ensure the preview from last point to mouse is ortho.
function buildDraftPolyline(from, points, end) {
  const pts = [from, ...(points || [])];
  const last = pts[pts.length - 1];
  const orthoEndPts = orthoSegment(last, end);
  return [...pts, ...orthoEndPts.slice(1)];
}

// Enforce orthogonal routing: if click point isn't aligned with last,
// insert an intermediate point so segments stay horizontal/vertical.
function addOrthoPoint(circuit, fromPinId, points, clicked) {
  const from = findPinPos(circuit, fromPinId);
  if (!from) return points;

  const current = [from, ...(points || [])];
  const last = current[current.length - 1];

  const seg = orthoSegment(last, clicked); // [last, mid?, clicked]
  // We only store intermediate points (excluding "last")
  // seg includes last as [0], so take from index 1 onward.
  const newPts = seg.slice(1);

  // Prevent adding duplicate last point
  const out = [...(points || [])];
  for (const p of newPts) {
    const prev = out[out.length - 1];
    if (!prev || prev.x !== p.x || prev.y !== p.y) out.push(p);
  }
  return out;
}

// Returns a Manhattan segment path from a->b: [a, (b.x,a.y) , b] OR [a, b] if aligned
function orthoSegment(a, b) {
  if (a.x === b.x || a.y === b.y) return [a, b];
  // horizontal then vertical (can swap later if you want)
  return [a, { x: b.x, y: a.y }, b];
}

function drawPolyline(ctx, pts) {
  if (!pts || pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

// --- wire hit test for stored polylines ---
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
      if (d < best.d) {
        best = { t: i, pt: a, d };
      }
      continue;
    }

    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));

    const cx = a.x + t * abx;
    const cy = a.y + t * aby;
    const d = Math.hypot(p.x - cx, p.y - cy);

    if (d < best.d) {
      best = { t: i + t, pt: { x: cx, y: cy }, d };
    }
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
