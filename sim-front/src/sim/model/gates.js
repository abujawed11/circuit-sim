import { KIND, LV, uid } from "./types";

export const pin = (name, dir) => ({
  id: uid(),
  name,
  dir, // "in" | "out"
  value: LV.X,
});

export const makeComponent = (kind, x, y) => {
  const base = {
    id: uid(),
    kind,
    x,
    y,
    w: 120,
    h: 70,
    pins: [],
    state: {}, // for INPUT toggle etc
  };

  switch (kind) {
    case KIND.INPUT:
      return {
        ...base,
        w: 60,
        h: 60,
        state: { value: LV.LOW },
        pins: [pin("OUT", "out")],
      };

    case KIND.BUTTON:
      return {
        ...base,
        w: 60,
        h: 60,
        state: { pressed: false },
        pins: [pin("OUT", "out")],
      };

    case KIND.VCC:
      return {
        ...base,
        w: 60,
        h: 60,
        state: { value: LV.HIGH },
        pins: [pin("OUT", "out")],
      };

    case KIND.GND:
      return {
        ...base,
        w: 60,
        h: 60,
        state: { value: LV.LOW },
        pins: [pin("OUT", "out")],
      };

    case KIND.LED:
      return {
        ...base,
        w: 110,
        h: 60,
        pins: [pin("IN", "in")],
      };

    case KIND.NOT:
      return {
        ...base,
        pins: [pin("A", "in"), pin("Y", "out")],
      };

    case KIND.AND:
    case KIND.OR:
    case KIND.XOR:
    case KIND.NAND:
    case KIND.NOR:
    case KIND.XNOR:
      return {
        ...base,
        pins: [pin("A", "in"), pin("B", "in"), pin("Y", "out")],
      };
    case KIND.JUNCTION:
      return {
        ...base,
        w: 20,
        h: 20,
        pins: [pin("IN", "in"), pin("OUT", "out")],
      };

    case KIND.PROBE:
      return {
        ...base,
        w: 60,
        h: 60,
        pins: [pin("IN", "in")],
      };

    case KIND.CLOCK:
      return {
        ...base,
        w: 60,
        h: 60,
        state: { value: LV.LOW, interval: 1000, mode: "AUTO" },
        pins: [pin("OUT", "out")],
      };

    case KIND.SR_LATCH:
      return {
        ...base,
        w: 100,
        h: 80,
        state: { q: LV.LOW },
        pins: [
          pin("S", "in"),
          pin("R", "in"),
          pin("Q", "out"),
          pin("QB", "out"),
        ],
      };

    case KIND.D_FF:
      return {
        ...base,
        w: 100,
        h: 80,
        state: { q: LV.LOW, lastClk: LV.LOW },
        pins: [
          pin("D", "in"),
          pin("CLK", "in"),
          pin("Q", "out"),
          pin("QB", "out"),
        ],
      };

    case KIND.JK_FF:
      return {
        ...base,
        w: 100,
        h: 80,
        state: { q: LV.LOW, lastClk: LV.LOW },
        pins: [
          pin("J", "in"),
          pin("CLK", "in"),
          pin("K", "in"),
          pin("Q", "out"),
          pin("QB", "out"),
        ],
      };

    case KIND.BUFFER:
      return {
        ...base,
        w: 100,
        h: 60,
        props: {
          delay: 2, // number of simulation cycles
        },
        state: {
          queue: [], // stores delayed values
        },
        pins: [pin("A", "in"), pin("Y", "out")],
      };

    case KIND.MUX: {
      const size = 2; // Default size, will be overridden by Editor during placement
      const selectCount = Math.log2(size);
      const pins = [];
      for (let i = 0; i < size; i++) pins.push(pin(`I${i}`, "in"));
      for (let i = 0; i < selectCount; i++) pins.push(pin(`S${i}`, "in"));
      pins.push(pin("Y", "out"));

      return {
        ...base,
        w: 100,
        h: Math.max(80, size * 20 + 20),
        props: { size },
        pins,
      };
    }

    case KIND.DEMUX: {
      const size = 2;
      const selectCount = Math.log2(size);
      const pins = [pin("I", "in")];
      for (let i = 0; i < selectCount; i++) pins.push(pin(`S${i}`, "in"));
      for (let i = 0; i < size; i++) pins.push(pin(`Y${i}`, "out"));

      return {
        ...base,
        w: 100,
        h: Math.max(80, size * 20 + 20),
        props: { size },
        pins,
      };
    }

    default:
      return base;
  }
};
