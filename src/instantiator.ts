export interface ASExports {
  [key: string]: (...args: number[]) => number | void;
}

export class AbortError extends Error {
  constructor(
    message: string,
    public readonly file: string,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(message);
    this.name = "AbortError";
  }
}

/**
 * Instancie un module WASM AssemblyScript.
 *
 * Fournit les imports obligatoires :
 *  - `env.memory`  : WebAssembly.Memory (initial 1 page = 64 Ko)
 *  - `env.abort`   : handler qui lève une AbortError lisible
 *
 * @returns Un objet plat ne contenant que les exports de type `function`.
 */
export async function instantiate(wasmBytes: Uint8Array): Promise<ASExports> {
  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    env: {
      abort() {},
    },
  });

  // Le module exporte sa propre mémoire (initialisée par la data section)
  const memory = instance.exports.memory as WebAssembly.Memory;

  const rawExports = instance.exports as Record<string, unknown>;

  // Ré-exporter nommément chaque fonction (objet plat, pas instance.exports)
  const flatExports: ASExports = {};
  for (const [key, value] of Object.entries(rawExports)) {
    if (typeof value === "function") {
      flatExports[key] = value as (...args: number[]) => number | void;
    }
  }

  return flatExports;
}
