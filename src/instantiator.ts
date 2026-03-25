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

  // Lire la longueur (code units UTF-16) stockée à ptr - 4
  const byteLength = dataView.getInt32(ptr - 4, true); // en octets
  const length = byteLength >>> 1;                     // en code-units

  if (length <= 0 || ptr + byteLength > buf.byteLength) return "";

  const u16 = new Uint16Array(buf, ptr, length);
  return String.fromCharCode(...u16);
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
  const memory = new WebAssembly.Memory({ initial: 1 });

  const imports = {
    env: {
      memory,
      abort(
        msgPtr: number,
        filePtr: number,
        line: number,
        col: number
      ): void {
        const message = readASString(memory, msgPtr);
        const file = readASString(memory, filePtr);
        throw new AbortError(
          `AbortError: ${message || "(no message)"} — ${file || "(unknown file)"}:${line}:${col}`,
          file,
          line,
          col
        );
      },
    },
  };

  const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
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
