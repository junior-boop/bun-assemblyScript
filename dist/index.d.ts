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