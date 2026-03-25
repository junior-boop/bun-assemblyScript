/**
 * Utilitaire de log léger en console sans aucune dépendance,
 * s'appuyant uniquement sur les séquences d'échappement ANSI natives.
 */

export function logSuccess(file: string, ms: number | string) {
  // \x1b[32m -> Vert, \x1b[0m -> Reset
  console.log(`\x1b[32m[bun-as] ✓ ${file} compiled in ${ms}ms\x1b[0m`);
}

export function logError(file: string, errors: string[]) {
  // \x1b[31m -> Rouge
  console.error(`\x1b[31m[bun-as] ✗ Error in ${file}\x1b[0m`);
  for (const error of errors) {
    console.error(`\x1b[31m  ${error}\x1b[0m`);
  }
}

export function logStart(count: number) {
  // \x1b[36m -> Cyan
  console.log(
    `\x1b[36m[bun-as] Watching ${count} AssemblyScript file${
      count > 1 ? "s" : ""
    }...\x1b[0m`
  );
}
