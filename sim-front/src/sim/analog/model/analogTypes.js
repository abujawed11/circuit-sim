// src/sim/analog/model/analogTypes.js

export const ANALOG_DOMAIN = "analog";

export const A_KIND = Object.freeze({
  RESISTOR: "A_RESISTOR",
  CAPACITOR: "A_CAPACITOR",
  INDUCTOR: "A_INDUCTOR",
  VDC: "A_VDC",
  GND: "A_GND",
});

export const SPICE_GROUND_NODE = "0";

export const ANALOG_PART_DEFS = Object.freeze({
  [A_KIND.RESISTOR]: {
    label: "Resistor",
    refPrefix: "R",
    defaultValue: "1k",     // store SPICE-friendly strings (recommended)
    size: { w: 90, h: 36 },
    pins: ["1", "2"],
  },
  [A_KIND.CAPACITOR]: {
    label: "Capacitor",
    refPrefix: "C",
    defaultValue: "1u",
    size: { w: 90, h: 36 },
    pins: ["1", "2"],
  },
  [A_KIND.INDUCTOR]: {
    label: "Inductor",
    refPrefix: "L",
    defaultValue: "1m",
    size: { w: 90, h: 36 },
    pins: ["1", "2"],
  },
  [A_KIND.VDC]: {
    label: "DC Voltage",
    refPrefix: "V",
    defaultValue: "5",
    size: { w: 100, h: 50 },
    pins: ["+", "-"],
  },
  [A_KIND.GND]: {
    label: "Ground",
    refPrefix: "0",
    defaultValue: SPICE_GROUND_NODE,
    size: { w: 40, h: 40 },
    pins: [SPICE_GROUND_NODE],
  },
});
