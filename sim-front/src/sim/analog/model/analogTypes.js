// src/sim/analog/model/analogTypes.js

export const ANALOG_DOMAIN = "analog";

// Keep kinds SPICE-ish and short (used by UI + netlist builder)
export const ANALOG_KIND = Object.freeze({
  R: "A_R",
  C: "A_C",
  L: "A_L",
  D: "A_DIODE",
  LED: "A_LED",
  NPN: "A_NPN",
  PNP: "A_PNP",
  OPAMP: "A_OPAMP",
  TRAFO: "A_TRAFO",
  VDC: "A_VDC",
  VAC: "A_VAC",
  VOLTMETER: "A_VM",
  AMMETER: "A_AM",
  GND: "A_GND",
});

export const SPICE_GROUND_NODE = "0";

export const ANALOG_PART_DEFS = Object.freeze({
  [ANALOG_KIND.R]: {
    label: "Resistor",
    refPrefix: "R",
    defaultValue: "1k",     // store SPICE-friendly strings (recommended)
    size: { w: 90, h: 36 },
    pins: ["1", "2"],
  },
  [ANALOG_KIND.C]: {
    label: "Capacitor",
    refPrefix: "C",
    defaultValue: "1u",
    size: { w: 90, h: 36 },
    pins: ["1", "2"],
  },
  [ANALOG_KIND.L]: {
    label: "Inductor",
    refPrefix: "L",
    defaultValue: "1m",
    size: { w: 90, h: 36 },
    pins: ["1", "2"],
  },
  [ANALOG_KIND.D]: {
    label: "Diode",
    refPrefix: "D",
    defaultValue: "D1N4148", // Standard model
    size: { w: 90, h: 36 },
    pins: ["A", "K"], // Anode, Cathode
  },
  [ANALOG_KIND.LED]: {
    label: "LED",
    refPrefix: "D",
    defaultValue: "D_LED", // We'll need to define a model for this
    size: { w: 90, h: 36 },
    pins: ["A", "K"],
  },
  [ANALOG_KIND.NPN]: {
    label: "NPN BJT",
    refPrefix: "Q",
    defaultValue: "2N2222",
    size: { w: 60, h: 60 },
    pins: ["C", "B", "E"],
  },
  [ANALOG_KIND.PNP]: {
    label: "PNP BJT",
    refPrefix: "Q",
    defaultValue: "2N2907",
    size: { w: 60, h: 60 },
    pins: ["C", "B", "E"],
  },
  [ANALOG_KIND.OPAMP]: {
    label: "OpAmp",
    refPrefix: "X",
    defaultValue: "LM741", // Subcircuit
    size: { w: 100, h: 80 },
    pins: ["+", "-", "OUT", "V+", "V-"],
  },
  [ANALOG_KIND.TRAFO]: {
    label: "Transformer",
    refPrefix: "T", // Pseudo-ref, will emit L1, L2, K
    defaultValue: "1m 1m 0.99", // L1 L2 Coupling
    size: { w: 80, h: 60 },
    pins: ["P1", "P2", "S1", "S2"], // Primary, Secondary
  },
  [ANALOG_KIND.VDC]: {
    label: "DC Voltage",
    refPrefix: "V",
    defaultValue: "5",
    size: { w: 100, h: 50 },
    pins: ["+", "-"],
  },
  [ANALOG_KIND.VAC]: {
    label: "AC Voltage",
    refPrefix: "V",
    defaultValue: "SIN(0 5 1k)",
    size: { w: 100, h: 50 },
    pins: ["+", "-"],
  },
  [ANALOG_KIND.VOLTMETER]: {
    label: "Voltmeter",
    refPrefix: "VM",
    defaultValue: "",
    size: { w: 64, h: 64 },
    pins: ["+", "-"],
  },
  [ANALOG_KIND.AMMETER]: {
    label: "Ammeter",
    // IMPORTANT: emitted as a 0V independent voltage source so ngspice can report branch current.
    // SPICE element type is determined by the first letter, so keep this starting with "V".
    refPrefix: "VA",
    defaultValue: "",
    size: { w: 64, h: 64 },
    pins: ["1", "2"],
  },
  [ANALOG_KIND.GND]: {
    label: "Ground",
    refPrefix: "0",
    defaultValue: SPICE_GROUND_NODE,
    size: { w: 40, h: 40 },
    pins: [SPICE_GROUND_NODE],
  },
});

// Back-compat alias (older files used A_KIND.*)
export const A_KIND = ANALOG_KIND;
