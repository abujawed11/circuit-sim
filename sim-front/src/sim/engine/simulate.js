import { KIND, LV } from "../model/types";

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
        const lastClk = c.state.lastClk ?? LV.LOW;
        let nextQ = c.state.q;

        if (clk === LV.HIGH && lastClk === LV.LOW) {
          nextQ = d;
        }
        c.state._nextQ = nextQ;
        c.state._nextLastClk = clk;
      }

      if (c.kind === KIND.JK_FF) {
        const j = inPins.find((p) => p.name === "J")?.value ?? LV.LOW;
        const k = inPins.find((p) => p.name === "K")?.value ?? LV.LOW;
        const clk = inPins.find((p) => p.name === "CLK")?.value ?? LV.LOW;
        const lastClk = c.state.lastClk ?? LV.LOW;
        let nextQ = c.state.q;

        if (clk === LV.HIGH && lastClk === LV.LOW) {
          if (j === LV.LOW && k === LV.HIGH) nextQ = LV.LOW;
          else if (j === LV.HIGH && k === LV.LOW) nextQ = LV.HIGH;
          else if (j === LV.HIGH && k === LV.HIGH)
            nextQ = nextQ === LV.HIGH ? LV.LOW : LV.HIGH;
        }
        c.state._nextQ = nextQ;
        c.state._nextLastClk = clk;
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
