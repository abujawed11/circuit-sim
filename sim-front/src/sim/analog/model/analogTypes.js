// src/sim/analog/model/analogTypes.js

export const ANALOG_DOMAIN = "analog";

// Keep kinds SPICE-ish and short (used by UI + netlist builder)
export const ANALOG_KIND = Object.freeze({
  R: "A_R",
  C: "A_C",
  L: "A_L",
  VDC: "A_VDC",
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
  [ANALOG_KIND.VDC]: {
    label: "DC Voltage",
    refPrefix: "V",
    defaultValue: "5",
    size: { w: 100, h: 50 },
    pins: ["+", "-"],
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
