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
  BUFFER: "BUFFER",
  MUX: "MUX",
  DEMUX: "DEMUX",
};

// Circuit structure:
// - components: placed items with pins
// - wires: connect output pin -> input pin (v1)
// - icDefinitions: library of custom ICs created by user
export const makeEmptyCircuit = () => ({
  components: [],
  wires: [],
  icDefinitions: [], // Array of IC definitions
});

// IC Definition structure
export const makeICDefinition = (name, inputPins, outputPins, internalCircuit) => ({
  id: uid(),
  name, // IC name (e.g., "HALF_ADDER")
  inputPins, // Array of { name: "A", order: 0 }
  outputPins, // Array of { name: "SUM", order: 0 }
  internalComponents: internalCircuit.components, // Saved sub-circuit
  internalWires: internalCircuit.wires,
  createdAt: Date.now(),
});
