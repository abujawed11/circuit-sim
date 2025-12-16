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
        w: 110,
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
      return {
        ...base,
        pins: [pin("A", "in"), pin("B", "in"), pin("Y", "out")],
      };

    default:
      return base;
  }
};
