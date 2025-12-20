import { KIND, LV } from "../model/types";

// Debug: Check if MUX/DEMUX constants exist
// console.log("simulate.js loaded - KIND.MUX:", KIND.MUX, "KIND.DEMUX:", KIND.DEMUX);

const inv = (v) => (v === LV.HIGH ? LV.LOW : v === LV.LOW ? LV.HIGH : LV.X);

const and2 = (a, b) => {
  if (a === LV.LOW || b === LV.LOW) return LV.LOW;
  if (a === LV.HIGH && b === LV.HIGH) return LV.HIGH;
  return LV.X;
};

const or2 = (a, b) => {
  if (a === LV.HIGH || b === LV.HIGH) return LV.HIGH;
  if (a === LV.LOW && b === LV.LOW) return LV.LOW;
  return LV.X;
};

const xor2 = (a, b) => {
  if (a === LV.X || b === LV.X) return LV.X;
  return a === b ? LV.LOW : LV.HIGH;
};

// Helper: find pin by id
export const getPin = (circuit, pinId) => {
  for (const c of circuit.components) {
    const p = c.pins.find((pp) => pp.id === pinId);
    if (p) return { comp: c, pin: p };
  }
  return null;
};

// Compute pin values by iterating until stable (works for combinational circuits)
export const simulate = (circuit, preSimulate = null) => {
  // Reset all pin values to X first
  for (const c of circuit.components) {
    for (const p of c.pins) p.value = LV.X;
  }

  if (preSimulate) preSimulate();

  // Seed INPUT, BUTTON, VCC, GND, CLOCK outputs from their state
  for (const c of circuit.components) {
    if (c.kind === KIND.INPUT || c.kind === KIND.CLOCK || c.kind === KIND.VCC || c.kind === KIND.GND) {
      const outPin = c.pins.find((p) => p.dir === "out");
      if (outPin) outPin.value = c.state.value;
    }
    if (c.kind === KIND.BUTTON) {
      const outPin = c.pins.find((p) => p.dir === "out");
      if (outPin) outPin.value = c.state.pressed ? LV.HIGH : LV.LOW;
    }
    // Seed Flip-Flops/Latches from internal state
    if (
      c.kind === KIND.SR_LATCH ||
      c.kind === KIND.D_FF ||
      c.kind === KIND.JK_FF ||
      c.kind === KIND.T_FF
    ) {
      const q = c.state.q;
      const qPin = c.pins.find((p) => p.name === "Q");
      const qbPin = c.pins.find((p) => p.name === "QB");
      if (qPin) qPin.value = q;
      if (qbPin) qbPin.value = q === LV.HIGH ? LV.LOW : q === LV.LOW ? LV.HIGH : LV.X;
    }
  }

  // ✅ BUFFER: Output delayed value (like flip-flops output stored state)
  for (const c of circuit.components) {
    if (c.kind === KIND.BUFFER) {
      // Init queue
      if (!Array.isArray(c.state.queue)) {
        c.state.queue = [];
      }

      const delay = Math.max(1, c.props.delay || 1);

      // Output the value at the front of the queue ONLY if we have reached the delay depth
      let output = LV.X;
      if (c.state.queue.length >= delay) {
        output = c.state.queue[0]; // Peek at oldest value
      }

      // Set output pin
      const outPin = c.pins.find((p) => p.dir === "out");
      if (outPin) outPin.value = output;
    }
  }

  // Iterate a few times to settle
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;

    // Drive inputs via wires (output -> input)
    // Group wires by target pin to handle multiple drivers
    // const wiresByTarget = new Map();
    // for (const w of circuit.wires) {
    //   if (!wiresByTarget.has(w.toPinId)) {
    //     wiresByTarget.set(w.toPinId, []);
    //   }
    //   wiresByTarget.get(w.toPinId).push(w);
    // }

    // // Apply wire values, handling conflicts
    // for (const [toPinId, wires] of wiresByTarget) {
    //   const to = getPin(circuit, toPinId);
    //   if (!to) continue;

    //   // Collect all driver values
    //   const driverValues = wires
    //     .map(w => getPin(circuit, w.fromPinId))
    //     .filter(Boolean)
    //     .map(from => from.pin.value);

    //   if (driverValues.length === 0) continue;

    //   // Resolve multiple drivers
    //   let resolvedValue;
    //   if (driverValues.length === 1) {
    //     resolvedValue = driverValues[0];
    //   } else {
    //     // Check if all drivers agree
    //     const firstValue = driverValues[0];
    //     const allAgree = driverValues.every(v => v === firstValue || v === LV.X);

    //     if (allAgree && firstValue !== LV.X) {
    //       resolvedValue = firstValue; // All agree on HIGH or LOW
    //     } else {
    //       // Conflict: different values driving the same pin
    //       resolvedValue = LV.X; // Show as undefined
    //     }
    //   }

    //   if (to.pin.value !== resolvedValue) {
    //     to.pin.value = resolvedValue;
    //     changed = true;
    //   }
    // }

    // ==========================================================
    // OPTION 2: Net-based undirected wire solving (connected nets)
    // ==========================================================

    // Build Union-Find (Disjoint Set) over all pin IDs
    const parent = new Map();

    const allPins = [];
    for (const cc of circuit.components) {
      for (const pp of cc.pins) {
        allPins.push({ comp: cc, pin: pp });
        parent.set(pp.id, pp.id);
      }
    }

    const find = (x) => {
      let p = parent.get(x);
      if (p === x) return x;
      p = find(p);
      parent.set(x, p);
      return p;
    };

    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    // 1) Wires are undirected edges: connect both endpoints into the same net
    for (const w of circuit.wires) {
      union(w.fromPinId, w.toPinId);
    }

    // 2) Junction should be a pure net node: its IN and OUT are the same net
    // Your junctions currently have IN + OUT pins :contentReference[oaicite:3]{index=3}
    for (const cc of circuit.components) {
      if (cc.kind === KIND.JUNCTION) {
        const a = cc.pins[0]?.id;
        const b = cc.pins[1]?.id;
        if (a && b) union(a, b);
      }
    }

    // Group pins by net root
    const nets = new Map(); // rootId -> array of {comp,pin}
    for (const { comp, pin } of allPins) {
      const r = find(pin.id);
      if (!nets.has(r)) nets.set(r, []);
      nets.get(r).push({ comp, pin });
    }

    const resolveNetValue = (nodes) => {
      // Drivers are pins with dir === "out" EXCEPT junction "OUT"
      // (junction is not a real driver; it's just a connection node)
      const driverVals = [];
      for (const n of nodes) {
        if (n.pin.dir === "out" && n.comp.kind !== KIND.JUNCTION) {
          driverVals.push(n.pin.value);
        }
      }

      // Remove X drivers if there are definite drivers
      const definite = driverVals.filter(v => v === LV.HIGH || v === LV.LOW);

      if (definite.length === 0) {
        // No definite drivers → floating net
        return LV.X;
      }

      const has1 = definite.includes(LV.HIGH);
      const has0 = definite.includes(LV.LOW);
      if (has1 && has0) return LV.X;  // conflict (short)
      return has1 ? LV.HIGH : LV.LOW;
    };

    // Apply resolved net value to pins in that net
    for (const nodes of nets.values()) {
      const netVal = resolveNetValue(nodes);

      for (const n of nodes) {
        // Junction pins should display the net value too
        if (n.comp.kind === KIND.JUNCTION) {
          if (n.pin.value !== netVal) {
            n.pin.value = netVal;
            changed = true;
          }
          continue;
        }

        // Inputs should read the net
        if (n.pin.dir === "in") {
          if (n.pin.value !== netVal) {
            n.pin.value = netVal;
            changed = true;
          }
        }

        // Optional: if an output is X but the net is driven by someone else,
        // you can reflect net value on it (useful for visual consistency).
        if (n.pin.dir === "out" && n.pin.value === LV.X && netVal !== LV.X) {
          n.pin.value = netVal;
          changed = true;
        }
      }
    }


    // Evaluate gates outputs from their input pins
    for (const c of circuit.components) {
      const inPins = c.pins.filter((p) => p.dir === "in");
      const outPins = c.pins.filter((p) => p.dir === "out");

      const setOut = (name, v) => {
        const p = outPins.find((pp) => pp.name === name) || outPins[0];
        if (p && p.value !== v) {
          p.value = v;
          changed = true;
        }
      };

      if (c.kind === KIND.NOT) {
        const a = inPins.find((p) => p.name === "A")?.value ?? LV.X;
        setOut("Y", inv(a));
      }

      if (c.kind === KIND.AND) {
        const a = inPins.find((p) => p.name === "A")?.value ?? LV.X;
        const b = inPins.find((p) => p.name === "B")?.value ?? LV.X;
        setOut("Y", and2(a, b));
      }

      if (c.kind === KIND.OR) {
        const a = inPins.find((p) => p.name === "A")?.value ?? LV.X;
        const b = inPins.find((p) => p.name === "B")?.value ?? LV.X;
        setOut("Y", or2(a, b));
      }

      if (c.kind === KIND.XOR) {
        const a = inPins.find((p) => p.name === "A")?.value ?? LV.X;
        const b = inPins.find((p) => p.name === "B")?.value ?? LV.X;
        setOut("Y", xor2(a, b));
      }

      if (c.kind === KIND.NAND) {
        const a = inPins.find((p) => p.name === "A")?.value ?? LV.X;
        const b = inPins.find((p) => p.name === "B")?.value ?? LV.X;
        setOut("Y", inv(and2(a, b)));
      }

      if (c.kind === KIND.NOR) {
        const a = inPins.find((p) => p.name === "A")?.value ?? LV.X;
        const b = inPins.find((p) => p.name === "B")?.value ?? LV.X;
        setOut("Y", inv(or2(a, b)));
      }

      if (c.kind === KIND.XNOR) {
        const a = inPins.find((p) => p.name === "A")?.value ?? LV.X;
        const b = inPins.find((p) => p.name === "B")?.value ?? LV.X;
        setOut("Y", inv(xor2(a, b)));
      }


      // =====================================================
      // ✅ NEW: 555 Timer IC — Monostable (Phase 2.2)
      // Digital approximation:
      // - Falling edge on TRIG starts a HIGH pulse for pulseMs
      // - RES LOW cancels pulse immediately
      // - THR HIGH can also end pulse early (optional but useful)
      // - OUT follows the monostable pulse
      // - DIS is LOW when OUT LOW, otherwise X (floating)
      // =====================================================
      if (c.kind === KIND.TIMER_555) {
        const now = Date.now();

        const getIn = (name, fallback = LV.X) =>
          inPins.find((p) => p.name === name)?.value ?? fallback;

        const trig = getIn("TRIG", LV.X);
        const thr = getIn("THR", LV.X);
        const res = getIn("RES", LV.HIGH);

        // pulse duration (ms)
        const pulseMs = Math.max(1, Number(c.props?.pulseMs ?? 800)); // default 800ms

        // persistent internal state
        if (!c.state) c.state = {};
        const lastTrig = c.state.lastTrig ?? LV.HIGH;   // for edge detect
        let monoEndAt = c.state.monoEndAt ?? 0;        // timestamp when pulse ends

        // Detect falling edge (HIGH -> LOW)
        const fallingEdge = (lastTrig === LV.HIGH && trig === LV.LOW);

        // Start pulse on falling edge (only once even if TRIG held low)
        if (fallingEdge && res !== LV.LOW) {
          monoEndAt = now + pulseMs;
        }

        // Cancel pulse if reset asserted
        if (res === LV.LOW) {
          monoEndAt = 0;
        }

        // Optional: end pulse early if THR goes HIGH
        if (thr === LV.HIGH) {
          monoEndAt = 0;
        }

        // OUT is HIGH while pulse active
        const active = monoEndAt > now;
        const outVal = active ? LV.HIGH : LV.LOW;

        // Save internal state
        c.state.lastTrig = trig;
        c.state.monoEndAt = monoEndAt;
        c.state.latch = outVal; // keep for debugging / future RC model

        // Drive outputs
        setOut("OUT", outVal);

        // DISCHARGE transistor ON when OUT LOW
        setOut("DIS", outVal === LV.LOW ? LV.LOW : LV.X);
      }



      if (c.kind === "IC_CUSTOM") {
        const icDef = circuit.icDefinitions?.find(d => d.id === c.icDefinitionId);
        if (icDef) {
          // 1. Initialize internal circuit if needed
          if (!c.state.internalCircuit) {
            c.state.internalCircuit = {
              components: structuredClone(icDef.internalComponents),
              wires: structuredClone(icDef.internalWires),
              icDefinitions: circuit.icDefinitions // Pass definitions down
            };
          }
          const internalCircuit = c.state.internalCircuit;

          // 2. Inject Inputs (External -> Internal)
          // Moved to callback to persist after reset
          const injectInputs = () => {
            for (const inputDef of icDef.inputPins) {
              const extPin = inPins.find(p => p.name === inputDef.name);

              // ✅ NEW: support driving multiple internal pins from one external pin
              const ids = inputDef.internalPinIds?.length
                ? inputDef.internalPinIds
                : [inputDef.internalPinId];

              for (const internalId of ids) {
                const found = getPin(internalCircuit, internalId);

                if (extPin && found) {
                  // If the internal pin belongs to an INPUT/BUTTON/VCC/GND/CLOCK, update its state
                  if (
                    found.comp.kind === KIND.INPUT ||
                    found.comp.kind === KIND.VCC ||
                    found.comp.kind === KIND.GND ||
                    found.comp.kind === KIND.CLOCK
                  ) {
                    found.comp.state.value = extPin.value;
                  } else if (found.comp.kind === KIND.BUTTON) {
                    found.comp.state.pressed = (extPin.value === LV.HIGH);
                  } else {
                    found.pin.value = extPin.value;
                  }
                }
              }
            }
          };

          // 3. Simulate Internal Circuit
          simulate(internalCircuit, injectInputs);

          // 3.5. CRITICAL: Persist sequential state for internal components
          // This ensures flip-flops/buffers inside ICs remember their state between ticks
          for (const internalComp of internalCircuit.components) {
            // Persist flip-flop state (q and lastClk)
            if (internalComp.state._nextQ !== undefined) {
              internalComp.state.q = internalComp.state._nextQ;
              delete internalComp.state._nextQ;
            }
            if (internalComp.state._nextLastClk !== undefined) {
              internalComp.state.lastClk = internalComp.state._nextLastClk;
              delete internalComp.state._nextLastClk;
            }
            // BUFFER state is already persisted in the queue, but ensure it exists
            if (internalComp.kind === KIND.BUFFER && !Array.isArray(internalComp.state.queue)) {
              internalComp.state.queue = [];
            }
          }

          // 4. Extract Outputs (Internal -> External)
          for (const outputDef of icDef.outputPins) {
            const found = getPin(internalCircuit, outputDef.internalPinId);
            if (found) {
              setOut(outputDef.name, found.pin.value);
            }
          }
        }
      }

      if (c.kind === KIND.JUNCTION) {
        const input = inPins[0]?.value ?? LV.X;
        for (const p of outPins) {
          if (p.value !== input) {
            p.value = input;
            changed = true;
          }
        }
      }

      // BUFFER is handled BEFORE settle loop (see above)
      // No need to update it during iteration

      // Sequential Logic State Calculation
      // (Outputs are driven by seeded state, we just compute next state here)
      if (c.kind === KIND.SR_LATCH) {
        const s = inPins.find((p) => p.name === "S")?.value ?? LV.LOW;
        const r = inPins.find((p) => p.name === "R")?.value ?? LV.LOW;
        let nextQ = c.state.q;
        if (s === LV.HIGH && r === LV.LOW) nextQ = LV.HIGH;
        else if (s === LV.LOW && r === LV.HIGH) nextQ = LV.LOW;
        else if (s === LV.HIGH && r === LV.HIGH) nextQ = LV.LOW; // Reset dominant
        c.state._nextQ = nextQ;
      }

      if (c.kind === KIND.D_FF) {
        const d = inPins.find((p) => p.name === "D")?.value ?? LV.LOW;
        const clk = inPins.find((p) => p.name === "CLK")?.value ?? LV.LOW;
        const pre = inPins.find((p) => p.name === "PRE")?.value ?? LV.LOW;
        const clr = inPins.find((p) => p.name === "CLR")?.value ?? LV.LOW;
        const lastClk = c.state.lastClk ?? LV.LOW;
        let nextQ = c.state.q;

        if (clr === LV.HIGH) {
          nextQ = LV.LOW;
        } else if (pre === LV.HIGH) {
          nextQ = LV.HIGH;
        } else if (clk === LV.HIGH && lastClk === LV.LOW) {
          nextQ = d;
        }
        c.state._nextQ = nextQ;
        c.state._nextLastClk = clk;
      }

      if (c.kind === KIND.JK_FF) {
        const j = inPins.find((p) => p.name === "J")?.value ?? LV.LOW;
        const k = inPins.find((p) => p.name === "K")?.value ?? LV.LOW;
        const clk = inPins.find((p) => p.name === "CLK")?.value ?? LV.LOW;
        const pre = inPins.find((p) => p.name === "PRE")?.value ?? LV.LOW;
        const clr = inPins.find((p) => p.name === "CLR")?.value ?? LV.LOW;
        const lastClk = c.state.lastClk ?? LV.LOW;
        let nextQ = c.state.q;

        if (clr === LV.HIGH) {
          nextQ = LV.LOW;
        } else if (pre === LV.HIGH) {
          nextQ = LV.HIGH;
        } else if (clk === LV.HIGH && lastClk === LV.LOW) {
          if (j === LV.LOW && k === LV.HIGH) nextQ = LV.LOW;
          else if (j === LV.HIGH && k === LV.LOW) nextQ = LV.HIGH;
          else if (j === LV.HIGH && k === LV.HIGH)
            nextQ = nextQ === LV.HIGH ? LV.LOW : LV.HIGH;
        }
        c.state._nextQ = nextQ;
        c.state._nextLastClk = clk;
      }

      if (c.kind === KIND.T_FF) {
        const t = inPins.find((p) => p.name === "T")?.value ?? LV.LOW;
        const clk = inPins.find((p) => p.name === "CLK")?.value ?? LV.LOW;
        const pre = inPins.find((p) => p.name === "PRE")?.value ?? LV.LOW;
        const clr = inPins.find((p) => p.name === "CLR")?.value ?? LV.LOW;
        const lastClk = c.state.lastClk ?? LV.LOW;
        let nextQ = c.state.q;

        if (clr === LV.HIGH) {
          nextQ = LV.LOW;
        } else if (pre === LV.HIGH) {
          nextQ = LV.HIGH;
        } else if (clk === LV.HIGH && lastClk === LV.LOW) {
          // Toggle if T is high
          if (t === LV.HIGH) {
            nextQ = nextQ === LV.HIGH ? LV.LOW : LV.HIGH;
          }
        }
        c.state._nextQ = nextQ;
        c.state._nextLastClk = clk;
      }

      if (c.kind === KIND.MUX) {
        // MUX Logic: Select one input (I0..In) based on Select lines (S0..Sm)
        const size = c.props.size || 2;
        const selectCount = Math.log2(size);

        // console.log(`\n=== MUX ${size}:1 (id=${c.id.substring(0,8)}...) ===`);
        // console.log(`Component kind: "${c.kind}", KIND.MUX="${KIND.MUX}"`);
        // console.log(`Output pins:`, outPins.map(p => `${p.name}(id=${p.id.substring(0,8)}...)`).join(', '));

        let selectIdx = 0;
        let selectValid = true;
        for (let i = 0; i < selectCount; i++) {
          const sPin = inPins.find(p => p.name === `S${i}`);
          const sVal = sPin?.value ?? LV.X;

          // Debug logging
          // console.log(`MUX Debug: S${i} pin:`, sPin ? `found, value=${sVal}` : 'NOT FOUND');

          if (sVal === LV.X) {
            selectValid = false;
            break;
          }
          if (sVal === LV.HIGH) selectIdx += Math.pow(2, i);
        }

        // console.log(`MUX Debug: selectIdx=${selectIdx}, selectValid=${selectValid}`);

        if (!selectValid) {
          setOut("Y", LV.X);
        } else {
          const selectedPin = inPins.find(p => p.name === `I${selectIdx}`);
          const selectedInput = selectedPin?.value ?? LV.X;

          // Debug logging
          // console.log(`MUX Debug: I${selectIdx} pin:`, selectedPin ? `found, value=${selectedInput}` : 'NOT FOUND');
          // console.log(`MUX Debug: Output Y=${selectedInput}`);

          setOut("Y", selectedInput);
        }
      }

      if (c.kind === KIND.DEMUX) {
        const size = c.props.size || 2;
        const selectCount = Math.log2(size);
        const inputVal = inPins.find(p => p.name === "I")?.value ?? LV.X;

        // console.log(`\n=== DEMUX 1:${size} (id=${c.id.substring(0,8)}...) ===`);
        // console.log(`Component kind: "${c.kind}", KIND.DEMUX="${KIND.DEMUX}"`);
        // console.log(`Output pins:`, outPins.map(p => `${p.name}(id=${p.id.substring(0,8)}...)`).join(', '));

        let selectIdx = 0;
        let selectValid = true;
        for (let i = 0; i < selectCount; i++) {
          const sVal = inPins.find(p => p.name === `S${i}`)?.value ?? LV.X;
          if (sVal === LV.X) {
            selectValid = false;
            break;
          }
          if (sVal === LV.HIGH) selectIdx += Math.pow(2, i);
        }

        for (let i = 0; i < size; i++) {
          if (!selectValid) {
            setOut(`Y${i}`, LV.X);
          } else {
            setOut(`Y${i}`, i === selectIdx ? inputVal : LV.LOW);
          }
        }
      }

      if (c.kind === KIND.BCD_7SEG) {
        const getVal = (n) => inPins.find(p => p.name === n)?.value ?? LV.X;
        const A = getVal("A");
        const B = getVal("B");
        const C = getVal("C");
        const D = getVal("D");

        if (A === LV.X || B === LV.X || C === LV.X || D === LV.X) {
          ["a", "b", "c", "d", "e", "f", "g"].forEach(seg => setOut(seg, LV.LOW)); // Off if undefined
        } else {
          const val = (D << 3) | (C << 2) | (B << 1) | A;

          // Segments: a, b, c, d, e, f, g
          const map = [
            // 0    1      2      3      4      5      6      7      8      9      A      b      C      d      E      F
            0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71
          ];
          /*
            Bit 0: a
            Bit 1: b
            Bit 2: c
            Bit 3: d
            Bit 4: e
            Bit 5: f
            Bit 6: g
          */

          const pattern = map[val];
          setOut("a", (pattern & 1) ? LV.HIGH : LV.LOW);
          setOut("b", (pattern & 2) ? LV.HIGH : LV.LOW);
          setOut("c", (pattern & 4) ? LV.HIGH : LV.LOW);
          setOut("d", (pattern & 8) ? LV.HIGH : LV.LOW);
          setOut("e", (pattern & 16) ? LV.HIGH : LV.LOW);
          setOut("f", (pattern & 32) ? LV.HIGH : LV.LOW);
          setOut("g", (pattern & 64) ? LV.HIGH : LV.LOW);
        }
      }
    }

    if (!changed) break;
  }

  // ✅ BUFFER: After settle loop, advance delay line for next simulation tick
  for (const c of circuit.components) {
    if (c.kind === KIND.BUFFER) {
      // Read the settled input value
      const inPin = c.pins.find((p) => p.dir === "in");
      const currentInput = inPin?.value ?? LV.X;

      // Push into queue
      c.state.queue.push(currentInput);

      const delay = Math.max(1, c.props.delay || 1);

      // Remove oldest value if queue is longer than delay
      if (c.state.queue.length > delay) {
        c.state.queue.shift();
      }

      // Limit queue size to prevent unbounded growth
      const maxQueueSize = delay + 5;
      if (c.state.queue.length > maxQueueSize) {
        c.state.queue = c.state.queue.slice(-maxQueueSize);
      }
    }
  }

  return circuit; // mutated in-place, simple for v1
};
