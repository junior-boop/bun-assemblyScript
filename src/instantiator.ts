export interface ASExports {
  [key: string]: (...args: number[]) => number | void;
}

export class AbortError extends Error {
  constructor(
    message: string,
    public readonly file: string,
    public readonly line: number,
    public readonly column: number
  ) {
    super(message);
    this.name = "AbortError";
  }
}

/**
 * Lit une String AssemblyScript depuis la mémoire linéaire.
 *
 * Format mémoire AS (runtime stub / minimal / full) :
 *   ptr - 16 : ClassID  (4 octets)
 *   ptr - 12 : reserved (4 octets)
 *   ptr -  8 : rtSize   (4 octets)  ← taille du buffer en octets
 *   ptr -  4 : length   (4 octets)  ← nombre de code units UTF-16
 *   ptr      : données UTF-16       ← longueur = length * 2 octets
 *
 * Si ptr est 0 ou invalide, retourne la chaîne vide.
 */
function readASString(memory: WebAssembly.Memory, ptr: number): string {
  if (ptr === 0) return "";

  const buf = memory.buffer;
  const dataView = new DataView(buf);

  // Lire la longueur (bytes) stockée à ptr - 4
  const byteLength = dataView.getInt32(ptr - 4, true);
  const length = byteLength >>> 1; // en code-units

  if (length <= 0 || ptr + byteLength > buf.byteLength) return "";

  const u16 = new Uint16Array(buf, ptr, length);

  // Chunking pour éviter le stack overflow avec String.fromCharCode(...spread)
  const CHUNK = 8192;
  let result = "";
  for (let i = 0; i < length; i += CHUNK) {
    const end = Math.min(i + CHUNK, length);
    const slice = u16.subarray(i, end);
    result += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return result;
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

  // Attacher la mémoire pour readASString
  flatExports.__memory = memory as unknown as (...args: number[]) => number | void;

  return flatExports;
}
