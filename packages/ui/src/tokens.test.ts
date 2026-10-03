import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { primitives } from "./tokens";

describe("tokens", () => {
  it("TS primitives mirror the CSS --dr-* primitives exactly", () => {
    const css = readFileSync(resolve(__dirname, "styles/darkroom.css"), "utf8");
    const fromCss = Object.fromEntries([...css.matchAll(/--dr-([a-z]+-\d+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]));
    expect(fromCss).toEqual(primitives);
  });
});
