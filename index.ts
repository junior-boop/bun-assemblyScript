/**
 * bun-assemblyscript
 * Plugin Bun pour importer des fichiers AssemblyScript (.as) directement.
 */

// Plugin principal
export { assemblyScriptPlugin } from "./src/plugin";
export type { PluginOptions } from "./src/plugin";

// Compilateur
export { compile } from "./src/compiler";
export type { CompilerOptions, CompilerResult } from "./src/compiler";

// Instantiateur
export { instantiate, AbortError } from "./src/instantiator";
export type { ASExports } from "./src/instantiator";

// Export par défaut
export { assemblyScriptPlugin as default } from "./src/plugin";
