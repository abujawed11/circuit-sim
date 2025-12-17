// Basic ids
export const uid = () => crypto.randomUUID();

// Logic values for v1
export const LV = {
  LOW: 0,
  HIGH: 1,
  X: "X", // unknown (optional in v1)
};

// Component kinds
export const KIND = {
  INPUT: "INPUT",
  BUTTON: "BUTTON",
  VCC: "VCC",
  GND: "GND",
  LED: "LED",
  AND: "AND",
  OR: "OR",
  NOT: "NOT",
  XOR: "XOR",
  NAND: "NAND",
  NOR: "NOR",
  XNOR: "XNOR",
  JUNCTION: "JUNCTION",
  PROBE: "PROBE",
  CLOCK: "CLOCK",
  SR_LATCH: "SR_LATCH",
  D_FF: "D_FF",
  JK_FF: "JK_FF",
};

// Circuit structure:
// - components: placed items with pins
// - wires: connect output pin -> input pin (v1)
// Later we can add nodes/nets, but this is fastest for v1.
export const makeEmptyCircuit = () => ({
  components: [],
  wires: [],
});
