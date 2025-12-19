import { KIND, LV, uid } from "./types";

// export const pin = (name, dir) => ({
//   id: uid(),
//   name,
//   dir, // "in" | "out"
//   value: LV.X,
// });

export const pin = (name, dir, extra = {}) => ({
  id: uid(),
  name,
  dir, // "in" | "out"
  value: LV.X,
  ...extra, // ✅ allow side, num, label, etc.
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
        w: 60,
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
          pin("PRE", "in"),
          pin("CLR", "in"),
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
          pin("PRE", "in"),
          pin("CLR", "in"),
          pin("Q", "out"),
          pin("QB", "out"),
        ],
      };

    case KIND.T_FF:
      return {
        ...base,
        w: 100,
        h: 80,
        state: { q: LV.LOW, lastClk: LV.LOW },
        pins: [
          pin("T", "in"),
          pin("CLK", "in"),
          pin("PRE", "in"),
          pin("CLR", "in"),
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

    case KIND.TIMER_555:
      return {
        ...base,
        w: 240,
        h: 180,
        // Pins match your screenshot layout
        pins: [
          // LEFT side
          pin("DIS", "out", { side: "left", num: 7, label: "dis" }),
          pin("THR", "in", { side: "left", num: 6, label: "thr" }),
          pin("TRIG", "in", { side: "left", num: 2, label: "trig" }),

          // TOP side
          pin("RES", "in", { side: "top", num: 4, label: "res" }),
          pin("VCC", "in", { side: "top", num: 8, label: "vcc" }),

          // RIGHT side
          pin("OUT", "out", { side: "right", num: 3, label: "out" }),
          pin("CTRL", "in", { side: "right", num: 5, label: "ctrl" }),

          // BOTTOM side
          pin("GND", "in", { side: "bottom", num: 1, label: "gnd" }),
        ],
      };

    case KIND.BCD_7SEG:
      return {
        ...base,
        w: 120,
        h: 160,
        pins: [
          // Inputs (BCD) - Left
          pin("A", "in", { side: "left", label: "A (1)" }),
          pin("B", "in", { side: "left", label: "B (2)" }),
          pin("C", "in", { side: "left", label: "C (4)" }),
          pin("D", "in", { side: "left", label: "D (8)" }),

          // Outputs (Segments) - Right
          pin("a", "out", { side: "right", label: "a" }),
          pin("b", "out", { side: "right", label: "b" }),
          pin("c", "out", { side: "right", label: "c" }),
          pin("d", "out", { side: "right", label: "d" }),
          pin("e", "out", { side: "right", label: "e" }),
          pin("f", "out", { side: "right", label: "f" }),
          pin("g", "out", { side: "right", label: "g" }),
        ],
      };

    case KIND.SEVEN_SEGMENT:
      return {
        ...base,
        w: 90,
        h: 160,
        pins: [
            pin("a", "in", { side: "left", label: "a" }),
            pin("b", "in", { side: "left", label: "b" }),
            pin("c", "in", { side: "left", label: "c" }),
            pin("d", "in", { side: "left", label: "d" }),
            pin("e", "in", { side: "left", label: "e" }),
            pin("f", "in", { side: "left", label: "f" }),
            pin("g", "in", { side: "left", label: "g" }),
            pin("dp", "in", { side: "left", label: "dp" }),
        ]
      };


    default:
      return base;
  }
};
