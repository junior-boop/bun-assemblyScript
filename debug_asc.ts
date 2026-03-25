// Script de debug isolé — à lancer via: bun run /tmp/debug_asc.ts
import { compile } from "./src/compiler";
import { resolve } from "path";

const file = resolve("test/fixtures/math.as");
console.log("Compiling:", file);

const result = await compile(file, { optimizeLevel: 0, runtime: "stub" });
console.log("success:", result.success);
console.log("wasmBytes length:", result.wasmBytes?.byteLength ?? null);
console.log("errors:", result.errors);
