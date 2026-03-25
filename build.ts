import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

console.log("Building bun-assemblyscript...");

const outDir = "./dist";
if (!existsSync(outDir)) {
  mkdirSync(outDir);
}

// 1. Build ESM (.mjs)
await Bun.build({
  entrypoints: ["./index.ts"],
  outdir: outDir,
  naming: "[name].mjs",
  target: "bun",
  format: "esm",
  minify: false,
});

// 2. Build CJS (.js)
await Bun.build({
  entrypoints: ["./index.ts"],
  outdir: outDir,
  naming: "[name].js",
  target: "node",
  format: "cjs",
  minify: false,
});

// 3. Types generation (Simplified for now - Copying assemblyscript.d.ts if needed or creating index.d.ts)
// In a real scenario we use tsc --emitDeclarationOnly, but Bun doesn't do that yet.
// For now, let's create a basic index.d.ts that mirrors index.ts
const indexDts = `
import { BunPlugin } from "bun";

export interface PluginOptions {
  compilerOverrides?: {
    optimizeLevel?: 0 | 1 | 2 | 3;
    runtime?: string;
    sourceMap?: boolean;
    debug?: boolean;
    [key: string]: any;
  };
}

export interface CompilerResult {
  success: boolean;
  wasmBytes: Uint8Array | null;
  errors: string[];
}

export interface ASExports {
  [key: string]: any;
}

export function assemblyScriptPlugin(options?: PluginOptions): BunPlugin;
export function compile(filename: string, options?: any): Promise<CompilerResult>;
export function instantiate(wasmBytes: Uint8Array): Promise<ASExports>;
export class AbortError extends Error {
  message: string;
  filename: string;
  line: number;
  column: number;
}
export default assemblyScriptPlugin;
`;

writeFileSync(join(outDir, "index.d.ts"), indexDts.trim());

console.log("Build complete!");
