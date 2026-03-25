import { Glob } from "bun";
import { watch } from "fs";
import { join, basename } from "path";
import { compile } from "../compiler";
import { get, set, computeHash, invalidate } from "../cache";
import { parseASExports } from "../typegen/parser";
import { generateDts, updateSnippets } from "../typegen/generator";
import { logSuccess, logError, logStart } from "./logger";

// Conserve les watchers et les hashes en mémoire vive
const hashes = new Map<string, string>();
const watchers = new Map<string, any>();

async function processFile(filePath: string, isInitial: boolean, isProd = false) {
  try {
    const text = await Bun.file(filePath).text();
    const hash = await computeHash(text);

    // Skip si strictement rien n'a changé en mémoire
    if (hashes.get(filePath) === hash) {
      if (isInitial) {
        // En initialisation, vérifier si le cache disque existe vraiment
        const cached = await get(filePath, hash);
        if (cached) return;
      } else {
        return; 
      }
    }

    hashes.set(filePath, hash);
    const startTime = performance.now();

    // Check le cache persistant sur disque
    const cached = await get(filePath, hash);
    if (cached) {
      if (!isInitial) {
        logSuccess(basename(filePath), Math.round(performance.now() - startTime) + " (cached)");
      }
      return;
    }

    // Compilation complète par asc
    const result = await compile(filePath, {
      optimizeLevel: isProd ? 3 : 0,
      runtime: isProd ? "minimal" : "stub",
    });

    if (!result.success || !result.wasmBytes) {
      logError(basename(filePath), result.errors);
      return;
    }

    // Régénération automatique des définitions TypeScript et Snippets
    const parsed = parseASExports(text);
    await generateDts(parsed, filePath);
    await updateSnippets(parsed, filePath);
    const dtsContent = await Bun.file(filePath + ".d.ts").text();

    // Enregistrer dans le cache disque
    await set(filePath, hash, result.wasmBytes, dtsContent);

    logSuccess(basename(filePath), Math.round(performance.now() - startTime));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // Fichier potentiellement supprimé
      await invalidate(filePath);
      hashes.delete(filePath);
    } else {
      logError(basename(filePath), [err instanceof Error ? err.message : String(err)]);
    }
  }
}

/**
 * Lance le daemon de surveillance.
 */
export async function startWatcher() {
  const glob = new Glob("**/*.as");
  const files: string[] = [];

  // Scan initial récursif avec Glob (ignore node_modules et caches)
  for (const file of glob.scanSync(".")) {
    if (file.includes("node_modules") || file.includes(".cache")) continue;
    const absPath = join(process.cwd(), file);
    files.push(absPath);
  }

  logStart(files.length);

  for (const file of files) {
    await processFile(file, true);

    const watcher = watch(file, async (event) => {
      if (event === "change" || event === "rename") {
        await processFile(file, false);
      }
    });
    watchers.set(file, watcher);
  }
}

/**
 * Compile tout le projet `as` en mode production (optimisation max).
 */
export async function startBuild() {
  const glob = new Glob("**/*.as");
  const files: string[] = [];

  for (const file of glob.scanSync(".")) {
    if (file.includes("node_modules") || file.includes(".cache")) continue;
    const absPath = join(process.cwd(), file);
    files.push(absPath);
  }

  for (const file of files) {
    await processFile(file, true, true);
  }
}
