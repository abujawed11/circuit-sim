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

  // Seed INPUT outputs from their state
  for (const c of circuit.components) {
    if (c.kind === KIND.INPUT || c.kind === KIND.CLOCK) {
      const outPin = c.pins.find((p) => p.dir === "out");
      if (outPin) outPin.value = c.state.value;
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

  // Iterate a few times to settle
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;

    // Drive inputs via wires (output -> input)
    for (const w of circuit.wires) {
      const from = getPin(circuit, w.fromPinId);
      const to = getPin(circuit, w.toPinId);
      if (!from || !to) continue;

      const v = from.pin.value;
      if (to.pin.value !== v) {
        to.pin.value = v;
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

      if (c.kind === KIND.JUNCTION) {
        const input = inPins[0]?.value ?? LV.X;
        for (const p of outPins) {
          if (p.value !== input) {
            p.value = input;
            changed = true;
          }
        }
      }

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

  return circuit; // mutated in-place, simple for v1
};
