import { describe, expect, it } from "vitest";
import { assessFrame } from "./selfie-quality";

const W = 720;
const H = 1280;
const good = { x: 210, y: 400, w: 300, h: 360 };

describe("assessFrame", () => {
  it("asks to look at the camera when nothing is found", () => {
    expect(assessFrame({ faces: [], frameW: W, frameH: H, brightness: 120 }).hint).toBe("no_face");
  });
  it("asks for light in the dark", () => {
    expect(assessFrame({ faces: [], frameW: W, frameH: H, brightness: 20 }).hint).toBe("light");
    expect(assessFrame({ faces: [good], frameW: W, frameH: H, brightness: 40 }).hint).toBe("light");
  });
  it("rejects two similar faces but ignores small background faces", () => {
    expect(assessFrame({ faces: [good, { ...good, x: 20 }], frameW: W, frameH: H, brightness: 120 }).hint).toBe("multiple");
    expect(assessFrame({ faces: [good, { x: 10, y: 10, w: 60, h: 70 }], frameW: W, frameH: H, brightness: 120 }).hint).toBe("ok");
  });
  it("guides distance and centring", () => {
    expect(assessFrame({ faces: [{ x: 320, y: 560, w: 100, h: 120 }], frameW: W, frameH: H, brightness: 120 }).hint).toBe("closer");
    expect(assessFrame({ faces: [{ x: 50, y: 300, w: 620, h: 700 }], frameW: W, frameH: H, brightness: 120 }).hint).toBe("back");
    expect(assessFrame({ faces: [{ ...good, x: 20 }], frameW: W, frameH: H, brightness: 120 }).hint).toBe("center");
  });
  it("asks to hold still on movement", () => {
    expect(assessFrame({ faces: [good], frameW: W, frameH: H, brightness: 120, previous: { ...good, x: good.x - 60 } }).hint).toBe("still");
    expect(assessFrame({ faces: [good], frameW: W, frameH: H, brightness: 120, previous: good }).hint).toBe("ok");
  });
});
