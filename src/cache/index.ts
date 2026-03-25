import { join, basename } from "path";
import { existsSync } from "fs";

export interface CacheMeta {
  hash: string;
  compiledAt: number;
  ascVersion: string;
}

export interface CacheEntry {
  wasmBytes: Uint8Array;
  dtsContent: string;
}

const CACHE_DIR = join(process.cwd(), ".cache", "bun-as");
const ASC_VERSION = "0.28.10"; // Version fixée par l'instruction d'installation

/**
 * Calcule le SHA256 d'un contenu de fichier via Bun.CryptoHasher.
 */
export async function computeHash(content: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}

/**
 * Assure que le cache Bun AssemblyScript est dans le .gitignore du projet.
 */
async function checkGitignore() {
  const gitignorePath = join(process.cwd(), ".gitignore");
  try {
    const content = await Bun.file(gitignorePath).text();
    if (!content.includes(".cache/bun-as")) {
      await Bun.write(
        gitignorePath,
        content + "\n# bun-assemblyscript cache\n.cache/bun-as/\n"
      );
    }
  } catch (err) {
    // Si .gitignore n'existe pas, on le créé
    await Bun.write(gitignorePath, ".cache/bun-as/\n");
  }
}

/**
 * Crée récursivement le dossier de cache spécifique au fichier.
 */
async function ensureCacheDir(fileName: string) {
  const dir = join(CACHE_DIR, fileName);
  const fs = await import("fs/promises");
  await fs.mkdir(dir, { recursive: true });
  await checkGitignore();
  return dir;
}

/**
 * Récupère une entrée du cache si le hash et la version asc correspondent.
 */
export async function get(
  filePath: string,
  currentHash: string
): Promise<CacheEntry | null> {
  const baseName = basename(filePath);
  const dir = join(CACHE_DIR, baseName);
  const metaPath = join(dir, "meta.json");

  if (!existsSync(metaPath)) return null;

  try {
    const meta: CacheMeta = await Bun.file(metaPath).json();
    
    // Si la version d'asc a changé, le cache est totalement invalide
    if (meta.ascVersion !== ASC_VERSION) {
      await invalidate(filePath);
      return null;
    }
    
    // Si le hash a changé, le cache n'est pas le bon
    if (meta.hash !== currentHash) {
      return null;
    }

    const wasmPath = join(dir, `${currentHash}.wasm`);
    const dtsPath = join(dir, `${currentHash}.d.ts`);

    if (!existsSync(wasmPath) || !existsSync(dtsPath)) return null;

    const wasmBytes = new Uint8Array(await Bun.file(wasmPath).arrayBuffer());
    const dtsContent = await Bun.file(dtsPath).text();

    return { wasmBytes, dtsContent };
  } catch {
    return null;
  }
}

/**
 * Enregistre une entrée WASM + DTS dans le cache.
 */
export async function set(
  filePath: string,
  currentHash: string,
  wasmBytes: Uint8Array,
  dtsContent: string
) {
  const baseName = basename(filePath);
  const dir = await ensureCacheDir(baseName);

  const wasmPath = join(dir, `${currentHash}.wasm`);
  const dtsPath = join(dir, `${currentHash}.d.ts`);
  const metaPath = join(dir, "meta.json");

  const meta: CacheMeta = {
    hash: currentHash,
    compiledAt: Date.now(),
    ascVersion: ASC_VERSION,
  };

  await Bun.write(wasmPath, wasmBytes);
  await Bun.write(dtsPath, dtsContent);
  await Bun.write(metaPath, JSON.stringify(meta, null, 2));
}

/**
 * Invalide manuellement le cache d'un fichier.
 */
export async function invalidate(filePath: string) {
  const baseName = basename(filePath);
  const dir = join(CACHE_DIR, baseName);
  try {
    const fs = await import("fs/promises");
    await fs.rm(dir, { recursive: true, force: true });
  } catch {}
}
