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
export const simulate = (circuit) => {
  // Reset all pin values to X first
  for (const c of circuit.components) {
    for (const p of c.pins) p.value = LV.X;
  }

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
      c.kind === KIND.JK_FF
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

      const delay = Math.max(0, c.props.delay || 0);

      // Output the value at the front of the queue (or X if empty)
      let output = LV.X;
      if (c.state.queue.length > 0) {
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
    const wiresByTarget = new Map();
    for (const w of circuit.wires) {
      if (!wiresByTarget.has(w.toPinId)) {
        wiresByTarget.set(w.toPinId, []);
      }
      wiresByTarget.get(w.toPinId).push(w);
    }

    // Apply wire values, handling conflicts
    for (const [toPinId, wires] of wiresByTarget) {
      const to = getPin(circuit, toPinId);
      if (!to) continue;

      // Collect all driver values
      const driverValues = wires
        .map(w => getPin(circuit, w.fromPinId))
        .filter(Boolean)
        .map(from => from.pin.value);

      if (driverValues.length === 0) continue;

      // Resolve multiple drivers
      let resolvedValue;
      if (driverValues.length === 1) {
        resolvedValue = driverValues[0];
      } else {
        // Check if all drivers agree
        const firstValue = driverValues[0];
        const allAgree = driverValues.every(v => v === firstValue || v === LV.X);

        if (allAgree && firstValue !== LV.X) {
          resolvedValue = firstValue; // All agree on HIGH or LOW
        } else {
          // Conflict: different values driving the same pin
          resolvedValue = LV.X; // Show as undefined
        }
      }

      if (to.pin.value !== resolvedValue) {
        to.pin.value = resolvedValue;
        changed = true;
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
              // CRITICAL FIX: Update the STATE of INPUT/BUTTON components, not just pin values
              // because simulate() will override pin values from component states
              for (const inputDef of icDef.inputPins) {
                  const extPin = inPins.find(p => p.name === inputDef.name);
                  const found = getPin(internalCircuit, inputDef.internalPinId);

                  if (extPin && found) {
                      // If the internal pin belongs to an INPUT/BUTTON/VCC/GND, update its state
                      if (found.comp.kind === KIND.INPUT || found.comp.kind === KIND.VCC ||
                          found.comp.kind === KIND.GND || found.comp.kind === KIND.CLOCK) {
                          found.comp.state.value = extPin.value;
                      } else if (found.comp.kind === KIND.BUTTON) {
                          // For BUTTON, set pressed state based on value
                          found.comp.state.pressed = (extPin.value === LV.HIGH);
                      } else {
                          // For regular gates, set the pin value directly
                          found.pin.value = extPin.value;
                      }
                  }
              }

              // 3. Simulate Internal Circuit
              simulate(internalCircuit);

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

      const delay = Math.max(0, c.props.delay || 0);

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
