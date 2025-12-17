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
    if (c.kind === KIND.INPUT) {
      const outPin = c.pins.find((p) => p.dir === "out");
      if (outPin) outPin.value = c.state.value;
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

      if (c.kind === KIND.JUNCTION) {
        const input = inPins[0]?.value ?? LV.X;
        for (const p of outPins) {
          if (p.value !== input) {
            p.value = input;
            changed = true;
          }
        }
      }

      // LED has no output; it just reads IN pin (used for UI glow)
      // INPUT output already seeded
    }

    if (!changed) break;
  }

  return circuit; // mutated in-place, simple for v1
};
