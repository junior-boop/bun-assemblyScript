import { resolve, basename } from "path";
import { tmpdir } from "os";

export interface CompilerOptions {
  optimizeLevel?: 0 | 1 | 2 | 3;
  shrinkLevel?: 0 | 1 | 2;
  runtime?: "minimal" | "stub" | "full" | "incremental";
  sourceMap?: boolean;
  debug?: boolean;
}

export interface CompilerResult {
  success: boolean;
  wasmBytes: Uint8Array | null;
  sourceMapBytes: Uint8Array | null;
  errors: string[];
}

/**
 * Résout le chemin du binaire `asc.js` depuis node_modules.
 * Lève une erreur claire si assemblyscript n'est pas installé.
 */
function resolveAscJs(cwd: string): string {
  const candidates = [
    resolve(cwd, "node_modules", "assemblyscript", "bin", "asc.js"),
    resolve(cwd, "..", "node_modules", "assemblyscript", "bin", "asc.js"),
  ];

  for (const candidate of candidates) {
    try {
      if (Bun.file(candidate).size > 0) return candidate;
    } catch {}
  }

  throw new Error(
    [
      "AssemblyScript compiler (asc) introuvable.",
      "Installez-le avec :",
      "  bun add -d assemblyscript",
    ].join("\n")
  );
}

/**
 * Crée un fichier `.ts` temporaire qui est une copie exacte du fichier `.as`.
 *
 * Pont .as → .ts : asc v0.28 n'accepte que les extensions `.ts`.
 * On copie le source dans un fichier temporaire `.ts`, on compile,
 * puis on supprime le temporaire.
 *
 * @returns Chemin absolu vers le fichier temporaire `.ts`.
 */
async function createTsBridge(asFilePath: string): Promise<string> {
  const source = await Bun.file(asFilePath).text();
  const baseName = basename(asFilePath, ".as");
  const tmpPath = resolve(tmpdir(), `asc_bridge_${baseName}_${Date.now()}.ts`);
  await Bun.write(tmpPath, source);
  return tmpPath;
}

/**
 * Compile un fichier `.as` en bytes WASM.
 *
 * Stratégie :
 *  1. Copier le `.as` en `.ts` temporaire (pont d'extension).
 *  2. Invoquer `node asc.js` via Bun.spawn() — on utilise node car asc v0.28
 *     appelle WebAssembly.instantiateStreaming() en interne, non supporté par Bun.
 *  3. Lire le fichier WASM généré.
 *  4. Nettoyer les fichiers temporaires.
 *
 * @param filename  Chemin absolu vers le fichier AssemblyScript source.
 * @param options   Options de compilation.
 */
export async function compile(
  filename: string,
  options: CompilerOptions = {}
): Promise<CompilerResult> {
  const errors: string[] = [];

  // 1. Résoudre asc.js
  let ascJs: string;
  try {
    ascJs = resolveAscJs(process.cwd());
  } catch (e) {
    return {
      success: false,
      wasmBytes: null,
      sourceMapBytes: null,
      errors: [e instanceof Error ? e.message : String(e)],
    };
  }

  // 2. Créer le pont .as → .ts
  let tsBridgePath: string | null = null;
  let outWasmPath: string | null = null;

  try {
    tsBridgePath = await createTsBridge(filename);
    outWasmPath = tsBridgePath.replace(/\.ts$/, ".wasm");

    // 3. Arguments CLI pour asc
    const args = [
      ascJs,
      tsBridgePath,
      "--outFile", outWasmPath,
      "--optimizeLevel", String(options.optimizeLevel ?? 0),
      "--runtime", options.runtime ?? "stub",
      "--exportRuntime",
    ];

    if (options.shrinkLevel !== undefined) {
      args.push("--shrinkLevel", String(options.shrinkLevel));
    }
    if (options.debug) args.push("--debug");
    if (options.sourceMap) args.push("--sourceMap");

    // 4. Lancer `node asc.js ...` — Node.js gère correctement WebAssembly.instantiateStreaming
    const proc = Bun.spawn(["node", ...args], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: process.cwd(),
    });

    const [stderrText] = await Promise.all([
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    const exitCode = proc.exitCode;

    // Collecter les erreurs stderr
    for (const line of stderrText.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length > 0) errors.push(trimmed);
    }

    if (exitCode !== 0) {
      return { success: false, wasmBytes: null, sourceMapBytes: null, errors };
    }

    // 5. Lire le WASM généré
    const wasmFile = Bun.file(outWasmPath);
    const wasmBytes = new Uint8Array(await wasmFile.arrayBuffer());

    let sourceMapBytes: Uint8Array | null = null;
    if (options.sourceMap) {
      const mapPath = outWasmPath + ".map";
      if (await Bun.file(mapPath).exists()) {
        sourceMapBytes = new Uint8Array(await Bun.file(mapPath).arrayBuffer());
      }
    }

    if (wasmBytes.byteLength === 0) {
      return {
        success: false,
        wasmBytes: null,
        sourceMapBytes: null,
        errors: [...errors, "Aucun output WASM produit par asc."],
      };
    }

    return { success: true, wasmBytes, sourceMapBytes, errors };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(message);
    return { success: false, wasmBytes: null, sourceMapBytes: null, errors };

  } finally {
    // 6. Nettoyer les fichiers temporaires dans tous les cas
    const fs = await import("fs/promises");
    for (const tmpFile of [tsBridgePath, outWasmPath, outWasmPath ? outWasmPath + ".map" : null]) {
      if (tmpFile) {
        try { await fs.unlink(tmpFile); } catch {}
      }
    }
  }
}
