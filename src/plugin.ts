import type { BunPlugin } from "bun";
import { compile, type CompilerOptions } from "./compiler";
import { instantiate } from "./instantiator";
import { parseASExports, type ASExport, type ASMethod } from "./typegen/parser";
import { generateDts } from "./typegen/generator";
import { join, basename } from "path";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { createHash } from "crypto";

// ─── Types ────────────────────────────────────────────────────

export interface PluginOptions {
  compilerOverrides?: Partial<CompilerOptions>;
  /** Timeout en ms pour la compilation AS (défaut: 30 000) */
  compileTimeout?: number;
  /** Forcer le mode d'embedding, sinon "auto" */
  embedMode?: EmbedMode;
}

type EmbedMode = "inline" | "file" | "auto";

interface GenerateModuleOptions {
  exportNames: string[];
  parsedExports: ASExport[];
  wasmSource: string;
  isInline: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────

const COMPLEX_TYPE_PATTERNS = ["string", "String", "Array", "Map", "Set", "Uint8Array", "Int32Array"] as const;

function isComplexType(t: string): boolean {
  const trim = t.trim();
  return COMPLEX_TYPE_PATTERNS.some((p) => trim === p || trim.startsWith(p + "<"));
}

function hasComplexExports(exports: ASExport[]): boolean {
  for (const exp of exports) {
    if (exp.kind === "class") return true;
    if (exp.type && isComplexType(exp.type)) return true;
    if (exp.returnType && isComplexType(exp.returnType)) return true;
    if (exp.params?.some((p) => isComplexType(p.type))) return true;

    // ASMethod[] — compatible avec la nouvelle interface
    const methods = exp.methods as ASMethod[] | undefined;
    if (methods?.length && hasComplexExports(
      methods.map((m) => ({ ...m, kind: "function" as const }))
    )) return true;
  }
  return false;
}

/**
 * Lit l'embedMode depuis bunfig.toml via une regex simple.
 * Retourne "auto" si absent ou illisible.
 */
async function readEmbedMode(cwd: string): Promise<EmbedMode> {
  const tomlPath = join(cwd, "bunfig.toml");
  if (!existsSync(tomlPath)) return "auto";

  try {
    const config = await Bun.file(tomlPath).text();
    const match = /embedMode\s*=\s*["']?(inline|file|auto)["']?/.exec(config);
    return (match?.[1] as EmbedMode) ?? "auto";
  } catch {
    return "auto";
  }
}

/** Compile avec un timeout pour éviter les hangs infinis */
async function compileWithTimeout(
  path: string,
  options: CompilerOptions,
  timeoutMs: number
): Promise<Awaited<ReturnType<typeof compile>>> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Compilation timeout after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([compile(path, options), timeout]);
}

// ─── Génération du module JS ──────────────────────────────────

function buildRuntimeHelpers(hasStringExports: boolean): string[] {
  const helpers: string[] = [
    `const { instance: __inst } = await WebAssembly.instantiate(__bin, {`,
    `  env: { abort() {} },`,
    `});`,
    ``,
    `// Utiliser la mémoire exportée par le module (initialisée par la data section)`,
    `const __memory = __inst.exports.memory;`,
    ``,
    `function __readStr(ptr) {`,
    `  if (!ptr) return "";`,
    `  const dv  = new DataView(__memory.buffer);`,
    `  const len = dv.getInt32(ptr - 4, true) >>> 1;`,
    `  if (len <= 0) return "";`,
    `  const u16 = new Uint16Array(__memory.buffer, ptr, len);`,
    `  const CHUNK = 8192;`,
    `  let s = "";`,
    `  for (let i = 0; i < len; i += CHUNK) {`,
    `    const end = i + CHUNK < len ? i + CHUNK : len;`,
    `    s += String.fromCharCode.apply(null, u16.subarray(i, end));`,
    `  }`,
    `  return s;`,
    `}`,
  ];

  if (hasStringExports) {
    helpers.push(
      ``,
      `function __writeStr(str) {`,
      `  if (str == null) return 0;`,
      `  if (typeof __inst.exports.__new !== "function") {`,
      `    throw new Error("AssemblyScript runtime does not export __new — use runtime: 'full' or 'incremental' for string support");`,
      `  }`,
      `  const len = str.length;`,
      `  const ptr = __inst.exports.__new(len << 1, 1);`,
      `  new Uint16Array(__memory.buffer, ptr, len)`,
      `    .set(Array.from({ length: len }, (_, i) => str.charCodeAt(i)));`,
      `  return ptr;`,
      `}`,
    );
  }

  return helpers;
}

function buildWasmLoader(wasmSource: string, isInline: boolean): string[] {
  if (isInline) {
    return [
      `const __b64  = ${JSON.stringify(wasmSource)};`,
      `const __bin  = Uint8Array.from(atob(__b64), (c) => c.charCodeAt(0));`,
    ];
  }
  return [
    `const __url = ${JSON.stringify(wasmSource)};`,
    `const __res = await fetch(__url);`,
    `const __bin = new Uint8Array(await __res.arrayBuffer());`,
  ];
}

/** Génère un wrapper JS pour une fonction avec params/retour string */
function buildFunctionWrapper(exp: ASExport): string[] {
  const stringParamIndices = new Set(
    exp.params
      ?.map((p, i) => (isComplexType(p.type) ? i : -1))
      .filter((i) => i !== -1) ?? []
  );
  const isStringReturn = exp.returnType && isComplexType(exp.returnType);
  const argsList = exp.params?.map((p) => p.name).join(", ") ?? "";

  const wrappedArgs = exp.params
    ?.map((p, i) => (stringParamIndices.has(i) ? `__writeStr(${p.name})` : p.name))
    .join(", ") ?? "";

  const lines = [
    `export const ${exp.name} = (${argsList}) => {`,
    `  const __r = __inst.exports.${exp.name}(${wrappedArgs});`,
    isStringReturn
      ? `  return __readStr(__r);`
      : `  return __r;`,
    `};`,
  ];
  return lines;
}

const AS_INTERNAL_PREFIX = /^__/;

function generateModule({
  exportNames,
  parsedExports,
  wasmSource,
  isInline,
}: GenerateModuleOptions): string {
  // Détecter si des exports utilisent des types string
  const hasStringExports = parsedExports.some((exp) =>
    exp.kind === "function" && (
      (exp.returnType && isComplexType(exp.returnType)) ||
      exp.params?.some((p) => isComplexType(p.type))
    )
  );

  const lines: string[] = [
    `// Auto-generated by bun-plugin-assemblyscript`,
    `// Do not edit manually`,
    ``,
    ...buildWasmLoader(wasmSource, isInline),
    ``,
    ...buildRuntimeHelpers(hasStringExports),
    ``,
  ];

  // Index des exports parsés
  const remaining = new Set(exportNames.filter((n) => !AS_INTERNAL_PREFIX.test(n)));

  for (const exp of parsedExports) {
    if (exp.kind !== "function" || !remaining.has(exp.name)) continue;

    const needsWrapper =
      (exp.returnType && isComplexType(exp.returnType)) ||
      exp.params?.some((p) => isComplexType(p.type));

    if (needsWrapper) {
      lines.push(...buildFunctionWrapper(exp));
    } else {
      lines.push(`export const ${exp.name} = __inst.exports.${exp.name};`);
    }
    remaining.delete(exp.name);
  }

  // Exports non parsés (constantes, fonctions sans signature connue)
  for (const name of remaining) {
    lines.push(`export const ${name} = __inst.exports.${name};`);
  }

  return lines.join("\n") + "\n";
}

// ─── Cache du sourcemap ───────────────────────────────────────

async function writeSourceMap(
  filePath: string,
  sourceMapBytes: Uint8Array,
  cwd: string
): Promise<void> {
  try {
    const source = await Bun.file(filePath).text();
    const hash = createHash("sha256").update(source).digest("hex");
    const cacheDir = join(cwd, ".cache", "bun-as", basename(filePath));
    const mapPath = join(cacheDir, `${hash}.wasm.map`);

    await mkdir(cacheDir, { recursive: true });
    await Bun.write(mapPath, sourceMapBytes);
  } catch (err) {
    console.warn("[bun-assemblyscript] Impossible d'écrire le sourcemap :", err);
  }
}

// ─── Plugin principal ─────────────────────────────────────────

export function assemblyScriptPlugin(options: PluginOptions = {}): BunPlugin {
  const {
    compilerOverrides = {},
    compileTimeout = 30_000,
  } = options;

  return {
    name: "bun-plugin-assemblyscript",

    setup(build) {
      build.onLoad({ filter: /\.as$/ }, async (args) => {
        const cwd = process.cwd();
        const isProd = process.env.NODE_ENV === "production" || !!build.config?.minify;
        const embedMode: EmbedMode = options.embedMode ?? await readEmbedMode(cwd);

        // ── 1. Parse des exports pour le typage et le runtime ──
        let parsedExports: ASExport[] = [];
        let hasComplex = false;

        try {
          const source = await Bun.file(args.path).text();
          // parseASExports retourne maintenant { exports, warnings }
          const result = parseASExports(source);
          parsedExports = result.exports;

          if (result.warnings.length > 0) {
            console.warn(
              `[bun-assemblyscript] ${result.warnings.length} warning(s) dans ${basename(args.path)} :`,
              result.warnings.map((w) => w.message).join(", ")
            );
          }

          await generateDts(parsedExports, args.path);
          hasComplex = hasComplexExports(parsedExports);
        } catch (err) {
          console.warn("[bun-assemblyscript] Génération de types échouée :", err);
        }

        // ── 2. Compilation AssemblyScript ──────────────────────
        const compilerOptions: CompilerOptions = {
          optimizeLevel: isProd ? 3 : 0,
          shrinkLevel: isProd ? 2 : 0,
          runtime: hasComplex ? "incremental" : "stub",
          sourceMap: !isProd,
          debug: !isProd,
          ...compilerOverrides,
        };

        let result: Awaited<ReturnType<typeof compile>>;
        try {
          result = await compileWithTimeout(args.path, compilerOptions, compileTimeout);
        } catch (err) {
          return {
            contents: "",
            errors: [{ text: String(err) }],
          };
        }

        if (!result.success || !result.wasmBytes) {
          return {
            contents: "",
            errors: result.errors.map((text) => ({ text })),
          };
        }

        // ── 3. Sourcemap (dev seulement) ───────────────────────
        if (!isProd && result.sourceMapBytes) {
          await writeSourceMap(args.path, result.sourceMapBytes, cwd);
        }

        // ── 4. Stratégie d'embedding ───────────────────────────
        const resolvedMode: Exclude<EmbedMode, "auto"> =
          embedMode === "auto"
            ? result.wasmBytes.length < 100_000 ? "inline" : "file"
            : embedMode;

        const exportsMap = await instantiate(result.wasmBytes);
        const exportNames = Object.keys(exportsMap).filter(
          (k) => k !== "__data_end" && k !== "__heap_base" && k !== "__memory" && k !== "memory"
        );

        if (resolvedMode === "inline") {
          const b64 = Buffer.from(result.wasmBytes).toString("base64");
          return {
            contents: generateModule({ exportNames, parsedExports, wasmSource: b64, isInline: true }),
            loader: "js",
          };
        }

        // ── 5. File mode : écriture du .wasm dans outdir ───────
        const outdir = build.config?.outdir ?? "./dist";
        const fileName = `module-${Bun.hash(result.wasmBytes)}.wasm`;
        const outPath = join(cwd, outdir, fileName);

        try {
          await mkdir(join(cwd, outdir), { recursive: true });
          await Bun.write(outPath, result.wasmBytes);
        } catch (err) {
          console.warn("[bun-assemblyscript] Écriture du .wasm échouée :", err);
        }

        return {
          contents: generateModule({
            exportNames,
            parsedExports,
            wasmSource: `./${fileName}`,
            isInline: false,
          }),
          loader: "js",
        };
      });
    },
  };
}