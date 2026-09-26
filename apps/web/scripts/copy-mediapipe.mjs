// Self-host MediaPipe's WASM (Apache-2.0) so the selfie page loads nothing from third parties.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve("@mediapipe/tasks-vision")), "wasm");
const dest = new URL("../public/mediapipe/wasm/", import.meta.url).pathname;
mkdirSync(dest, { recursive: true });
for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  if (!existsSync(join(dest, f))) copyFileSync(join(src, f), join(dest, f));
}
console.log("mediapipe wasm ready");
