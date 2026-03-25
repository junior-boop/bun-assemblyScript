// @bun
// src/compiler.ts
import { resolve, basename } from "path";
import { tmpdir } from "os";
import { unlink } from "fs/promises";
function resolveAscJs(cwd) {
  const candidates = [
    resolve(cwd, "node_modules", "assemblyscript", "bin", "asc.js"),
    resolve(cwd, "..", "node_modules", "assemblyscript", "bin", "asc.js")
  ];
  for (const candidate of candidates) {
    try {
      if (Bun.file(candidate).size > 0)
        return candidate;
    } catch {}
  }
  throw new Error([
    "AssemblyScript compiler (asc) introuvable.",
    "Installez-le avec :",
    "  bun add -d assemblyscript"
  ].join(`
`));
}
async function createTsBridge(asFilePath) {
  try {
    const source = await Bun.file(asFilePath).text();
    const baseName = basename(asFilePath, ".as");
    const tmpPath = resolve(tmpdir(), `asc_bridge_${baseName}_${Date.now()}.ts`);
    await Bun.write(tmpPath, source);
    return tmpPath;
  } catch (err) {
    throw new Error(`Failed to create TypeScript bridge for ${asFilePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
async function compile(filename, options = {}) {
  const errors = [];
  let ascJs;
  try {
    ascJs = resolveAscJs(process.cwd());
  } catch (e) {
    return {
      success: false,
      wasmBytes: null,
      sourceMapBytes: null,
      errors: [e instanceof Error ? e.message : String(e)]
    };
  }
  let tsBridgePath = null;
  let outWasmPath = null;
  try {
    tsBridgePath = await createTsBridge(filename);
    outWasmPath = tsBridgePath.replace(/\.ts$/, ".wasm");
    const args = [
      ascJs,
      tsBridgePath,
      "--outFile",
      outWasmPath,
      "--optimizeLevel",
      String(options.optimizeLevel ?? 0),
      "--runtime",
      options.runtime ?? "stub",
      "--exportRuntime"
    ];
    if (options.shrinkLevel !== undefined) {
      args.push("--shrinkLevel", String(options.shrinkLevel));
    }
    if (options.debug)
      args.push("--debug");
    if (options.sourceMap)
      args.push("--sourceMap");
    const proc = Bun.spawn(["node", ...args], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: process.cwd()
    });
    const [stderrText] = await Promise.all([
      new Response(proc.stderr).text(),
      proc.exited
    ]);
    const exitCode = proc.exitCode;
    for (const line of stderrText.split(`
`)) {
      const trimmed = line.trim();
      if (trimmed.length > 0)
        errors.push(trimmed);
    }
    if (exitCode !== 0) {
      return {
        success: false,
        wasmBytes: null,
        sourceMapBytes: null,
        errors: errors.length > 0 ? errors : [`Compilation failed with exit code ${exitCode}`]
      };
    }
    const wasmFile = Bun.file(outWasmPath);
    const wasmBytes = new Uint8Array(await wasmFile.arrayBuffer());
    let sourceMapBytes = null;
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
        errors: [...errors, "No WASM output produced by asc compiler."]
      };
    }
    return { success: true, wasmBytes, sourceMapBytes, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Failed to create TypeScript bridge")) {
      errors.push(message);
    } else {
      errors.push(`Compilation error: ${message}`);
    }
    return { success: false, wasmBytes: null, sourceMapBytes: null, errors };
  } finally {
    for (const tmpFile of [
      tsBridgePath,
      outWasmPath,
      outWasmPath ? outWasmPath + ".map" : null
    ]) {
      if (tmpFile) {
        try {
          await unlink(tmpFile);
        } catch {}
      }
    }
  }
}

// src/instantiator.ts
class AbortError extends Error {
  file;
  line;
  column;
  constructor(message, file, line, column) {
    super(message);
    this.file = file;
    this.line = line;
    this.column = column;
    this.name = "AbortError";
  }
}
async function instantiate(wasmBytes) {
  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    env: {
      abort() {}
    }
  });
  const memory = instance.exports.memory;
  const rawExports = instance.exports;
  const flatExports = {};
  for (const [key, value] of Object.entries(rawExports)) {
    if (typeof value === "function") {
      flatExports[key] = value;
    }
  }
  return flatExports;
}

// src/typegen/parser.ts
function stripComments(source) {
  const chars = [...source];
  let i = 0;
  while (i < chars.length) {
    if (chars[i] === '"' || chars[i] === "'" || chars[i] === "`") {
      const quote = chars[i];
      i++;
      while (i < chars.length && chars[i] !== quote) {
        if (chars[i] === "\\")
          i++;
        i++;
      }
      i++;
      continue;
    }
    if (chars[i] === "/" && chars[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < chars.length - 1 && !(chars[i] === "*" && chars[i + 1] === "/")) {
        chars[i] = " ";
        i++;
      }
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      continue;
    }
    if (chars[i] === "/" && chars[i + 1] === "/") {
      while (i < chars.length && chars[i] !== `
`) {
        chars[i] = " ";
        i++;
      }
      continue;
    }
    i++;
  }
  return chars.join("");
}
function parseParams(paramsStr, warnings) {
  if (!paramsStr.trim())
    return [];
  const parts = [];
  let depth = 0;
  let cursor = 0;
  for (let i = 0;i < paramsStr.length; i++) {
    if (paramsStr[i] === '"' || paramsStr[i] === "'") {
      const quote = paramsStr[i];
      i++;
      while (i < paramsStr.length && paramsStr[i] !== quote) {
        if (paramsStr[i] === "\\")
          i++;
        i++;
      }
      continue;
    }
    if (paramsStr[i] === "<")
      depth++;
    else if (paramsStr[i] === ">")
      depth--;
    else if (paramsStr[i] === "," && depth === 0) {
      parts.push(paramsStr.slice(cursor, i));
      cursor = i + 1;
    }
  }
  parts.push(paramsStr.slice(cursor));
  return parts.map((raw) => raw.trim()).filter(Boolean).map((raw) => {
    const optMatch = /^([a-zA-Z0-9_]+)(\?)?\s*:\s*([\s\S]+?)(?:\s*=\s*([\s\S]+))?$/.exec(raw);
    if (!optMatch) {
      warnings.push({ kind: "ambiguous_param", message: `Unparseable param: "${raw}"` });
      return { name: raw, type: "unknown" };
    }
    return {
      name: optMatch[1],
      optional: optMatch[2] === "?" || undefined,
      type: optMatch[3].trim(),
      defaultValue: optMatch[4]?.trim()
    };
  });
}
function parseGenerics(declaration) {
  const m = /<([^>]+)>/.exec(declaration);
  if (!m)
    return [];
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
}
function extractBlock(text, startIndex, warnings) {
  let depth = 0;
  let bodyStart = -1;
  for (let i = startIndex;i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === "\\")
          i++;
        i++;
      }
      continue;
    }
    if (ch === "{") {
      if (depth === 0)
        bodyStart = i + 1;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && bodyStart !== -1) {
        return { body: text.slice(bodyStart, i), end: i };
      }
    }
  }
  warnings.push({
    kind: "unterminated_block",
    message: `Unterminated block starting at offset ${startIndex}`,
    offset: startIndex
  });
  return { body: "", end: text.length };
}
function parseClassFields(body, warnings) {
  const fields = [];
  const fieldRegex = /(?:(public|protected|private)\s+)?(?:(static)\s+)?(?:(readonly)\s+)?([a-zA-Z0-9_]+)\s*:\s*([^;=\n]+)/g;
  let m;
  while ((m = fieldRegex.exec(body)) !== null) {
    const after = body.slice(m.index + m[0].length).trimStart();
    if (after.startsWith("("))
      continue;
    fields.push({
      visibility: m[1] ?? "public",
      isStatic: m[2] === "static",
      isReadonly: m[3] === "readonly",
      name: m[4],
      type: m[5].trim()
    });
  }
  return fields;
}
function parseClassMethods(body, warnings) {
  const methods = [];
  const methodRegex = /(?:(public|protected|private)\s+)?(?:(static)\s+)?(?:(abstract)\s+)?([a-zA-Z0-9_]+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*:\s*([^;{]+)/g;
  let m;
  while ((m = methodRegex.exec(body)) !== null) {
    const name = m[4];
    if (name === "constructor")
      continue;
    const visibility = m[1] ?? "public";
    const generics = m[5] ? parseGenerics(m[5]) : [];
    const params = parseParams(m[6], warnings);
    const returnType = m[7].trim();
    methods.push({
      kind: "function",
      visibility,
      isStatic: m[2] === "static",
      isAbstract: m[3] === "abstract",
      name,
      params,
      returnType,
      generics: generics.length > 0 ? generics : undefined
    });
  }
  return methods;
}
function parseASExports(source) {
  const text = stripComments(source);
  const exports = [];
  const warnings = [];
  const classRanges = [];
  const classPrescan = /export\s+class\s+[a-zA-Z0-9_]+/g;
  let prescanMatch;
  while ((prescanMatch = classPrescan.exec(text)) !== null) {
    const { end } = extractBlock(text, prescanMatch.index, warnings);
    classRanges.push([prescanMatch.index, end]);
  }
  const isInsideClass = (offset) => classRanges.some(([start, end]) => offset > start && offset < end);
  const fnRegex = /export\s+function\s+([a-zA-Z0-9_]+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*:\s*([^;{]+)/g;
  let match;
  while ((match = fnRegex.exec(text)) !== null) {
    if (isInsideClass(match.index))
      continue;
    const generics = match[2] ? parseGenerics(match[2]) : [];
    const params = parseParams(match[3], warnings);
    const returnType = match[4].trim();
    exports.push({
      kind: "function",
      name: match[1],
      params,
      returnType,
      generics: generics.length > 0 ? generics : undefined
    });
  }
  const constRegex = /export\s+const\s+([a-zA-Z0-9_]+)\s*:\s*([^=;\n]+)/g;
  while ((match = constRegex.exec(text)) !== null) {
    if (isInsideClass(match.index))
      continue;
    exports.push({ kind: "const", name: match[1], type: match[2].trim() });
  }
  const classRegex = /export\s+class\s+([a-zA-Z0-9_]+)\s*(<[^>]*>)?/g;
  while ((match = classRegex.exec(text)) !== null) {
    const className = match[1];
    const generics = match[2] ? parseGenerics(match[2]) : [];
    const { body } = extractBlock(text, match.index, warnings);
    const methods = parseClassMethods(body, warnings);
    const fields = parseClassFields(body, warnings);
    exports.push({
      kind: "class",
      name: className,
      generics: generics.length > 0 ? generics : undefined,
      methods,
      fields
    });
  }
  return { exports, warnings };
}

// src/typegen/typemap.ts
function mapType(asType) {
  const t = asType.trim();
  switch (t) {
    case "i8":
    case "i16":
    case "i32":
    case "i64":
    case "u8":
    case "u16":
    case "u32":
    case "u64":
    case "f32":
    case "f64":
    case "isize":
    case "usize":
      return "number";
    case "bool":
      return "boolean";
    case "string":
    case "String":
      return "string";
    case "void":
      return "void";
  }
  const arrayMatch = t.match(/^(?:Static)?Array<(.+)>$/);
  if (arrayMatch) {
    return `${mapType(arrayMatch[1])}[]`;
  }
  const mapMatch = t.match(/^Map<(.+?)\s*,\s*(.+)>$/);
  if (mapMatch) {
    return `Map<${mapType(mapMatch[1])}, ${mapType(mapMatch[2])}>`;
  }
  console.warn(`[bun-assemblyscript] Warning : Type AssemblyScript non reconnu '${t}'. Fallback sur 'unknown'.`);
  return "unknown";
}

// src/typegen/generator.ts
import { createHash } from "crypto";
async function generateDts(exports, sourcePath) {
  const lines = [
    "// auto-generated by bun-plugin-assemblyscript \u2014 do not edit",
    ""
  ];
  for (const exp of exports) {
    if (exp.kind === "const") {
      lines.push(`export const ${exp.name}: ${mapType(exp.type)};`);
    } else if (exp.kind === "function") {
      const params = exp.params.map((p) => `${p.name}: ${mapType(p.type)}`).join(", ");
      lines.push(`export function ${exp.name}(${params}): ${mapType(exp.returnType)};`);
    } else if (exp.kind === "class") {
      lines.push(`export class ${exp.name} {`);
      if (exp.methods) {
        for (const m of exp.methods) {
          const params = m.params.map((p) => `${p.name}: ${mapType(p.type)}`).join(", ");
          lines.push(`  ${m.name}(${params}): ${mapType(m.returnType)};`);
        }
      }
      lines.push(`}`);
    }
  }
  const dtsContent = lines.join(`
`) + `
`;
  const dtsPath = sourcePath + ".d.ts";
  const newHash = createHash("sha256").update(dtsContent).digest("hex");
  try {
    const existingContent = await Bun.file(dtsPath).text();
    const oldHash = createHash("sha256").update(existingContent).digest("hex");
    if (newHash === oldHash) {
      return;
    }
  } catch (err) {}
  await Bun.write(dtsPath, dtsContent);
}

// src/plugin.ts
import { join, basename as basename2 } from "path";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { createHash as createHash2 } from "crypto";
var COMPLEX_TYPE_PATTERNS = [
  "string",
  "String",
  "Array",
  "Map",
  "Set",
  "Uint8Array",
  "Int32Array"
];
function isComplexType(t) {
  const trim = t.trim();
  return COMPLEX_TYPE_PATTERNS.some((p) => trim === p || trim.startsWith(p + "<"));
}
function hasComplexExports(exports) {
  for (const exp of exports) {
    if (exp.kind === "class")
      return true;
    if (exp.type && isComplexType(exp.type))
      return true;
    if (exp.returnType && isComplexType(exp.returnType))
      return true;
    if (exp.params?.some((p) => isComplexType(p.type)))
      return true;
    const methods = exp.methods;
    if (methods?.length && hasComplexExports(methods.map((m) => ({ ...m, kind: "function" }))))
      return true;
  }
  return false;
}
async function readEmbedMode(cwd) {
  const tomlPath = join(cwd, "bunfig.toml");
  if (!existsSync(tomlPath))
    return "auto";
  try {
    const config = await Bun.file(tomlPath).text();
    const match = /embedMode\s*=\s*["']?(inline|file|auto)["']?/.exec(config);
    return match?.[1] ?? "auto";
  } catch {
    return "auto";
  }
}
async function compileWithTimeout(path, options, timeoutMs) {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Compilation timeout after ${timeoutMs}ms`)), timeoutMs));
  return Promise.race([compile(path, options), timeout]);
}
function buildRuntimeHelpers(hasStringExports) {
  const helpers = [
    `const { instance: __inst } = await WebAssembly.instantiate(__bin, {`,
    `  env: { abort() {} },`,
    `});`,
    ``,
    `// Utiliser la m\xE9moire export\xE9e par le module (initialis\xE9e par la data section)`,
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
    `}`
  ];
  if (hasStringExports) {
    helpers.push(``, `function __writeStr(str) {`, `  if (str == null) return 0;`, `  if (typeof __inst.exports.__new !== "function") {`, `    throw new Error("AssemblyScript runtime does not export __new \u2014 use runtime: 'full' or 'incremental' for string support");`, `  }`, `  const len = str.length;`, `  const ptr = __inst.exports.__new(len << 1, 1);`, `  new Uint16Array(__memory.buffer, ptr, len)`, `    .set(Array.from({ length: len }, (_, i) => str.charCodeAt(i)));`, `  return ptr;`, `}`);
  }
  return helpers;
}
function buildWasmLoader(wasmSource, isInline) {
  if (isInline) {
    return [
      `const __b64  = ${JSON.stringify(wasmSource)};`,
      `const __bin  = Uint8Array.from(atob(__b64), (c) => c.charCodeAt(0));`
    ];
  }
  return [
    `const __url = ${JSON.stringify(wasmSource)};`,
    `const __res = await fetch(__url);`,
    `const __bin = new Uint8Array(await __res.arrayBuffer());`
  ];
}
function buildFunctionWrapper(exp) {
  const stringParamIndices = new Set(exp.params?.map((p, i) => isComplexType(p.type) ? i : -1).filter((i) => i !== -1) ?? []);
  const isStringReturn = exp.returnType && isComplexType(exp.returnType);
  const argsList = exp.params?.map((p) => p.name).join(", ") ?? "";
  const wrappedArgs = exp.params?.map((p, i) => stringParamIndices.has(i) ? `__writeStr(${p.name})` : p.name).join(", ") ?? "";
  const lines = [
    `export const ${exp.name} = (${argsList}) => {`,
    `  const __r = __inst.exports.${exp.name}(${wrappedArgs});`,
    isStringReturn ? `  return __readStr(__r);` : `  return __r;`,
    `};`
  ];
  return lines;
}
var AS_INTERNAL_PREFIX = /^__/;
function generateModule({
  exportNames,
  parsedExports,
  wasmSource,
  isInline
}) {
  const hasStringExports = parsedExports.some((exp) => exp.kind === "function" && (exp.returnType && isComplexType(exp.returnType) || exp.params?.some((p) => isComplexType(p.type))));
  const lines = [
    `// Auto-generated by bun-plugin-assemblyscript`,
    `// Do not edit manually`,
    ``,
    ...buildWasmLoader(wasmSource, isInline),
    ``,
    ...buildRuntimeHelpers(hasStringExports),
    ``
  ];
  const remaining = new Set(exportNames.filter((n) => !AS_INTERNAL_PREFIX.test(n)));
  for (const exp of parsedExports) {
    if (exp.kind !== "function" || !remaining.has(exp.name))
      continue;
    const needsWrapper = exp.returnType && isComplexType(exp.returnType) || exp.params?.some((p) => isComplexType(p.type));
    if (needsWrapper) {
      lines.push(...buildFunctionWrapper(exp));
    } else {
      lines.push(`export const ${exp.name} = __inst.exports.${exp.name};`);
    }
    remaining.delete(exp.name);
  }
  for (const name of remaining) {
    lines.push(`export const ${name} = __inst.exports.${name};`);
  }
  return lines.join(`
`) + `
`;
}
async function writeSourceMap(filePath, sourceMapBytes, cwd) {
  try {
    const source = await Bun.file(filePath).text();
    const hash = createHash2("sha256").update(source).digest("hex");
    const cacheDir = join(cwd, ".cache", "bun-as", basename2(filePath));
    const mapPath = join(cacheDir, `${hash}.wasm.map`);
    await mkdir(cacheDir, { recursive: true });
    await Bun.write(mapPath, sourceMapBytes);
  } catch (err) {
    console.warn("[bun-assemblyscript] Impossible d'\xE9crire le sourcemap :", err);
  }
}
function assemblyScriptPlugin(options = {}) {
  const { compilerOverrides = {}, compileTimeout = 30000 } = options;
  return {
    name: "bun-plugin-assemblyscript",
    setup(build) {
      build.onLoad({ filter: /\.as$/ }, async (args) => {
        const cwd = process.cwd();
        const isProd = !!build.config?.minify;
        const embedMode = options.embedMode ?? await readEmbedMode(cwd);
        let parsedExports = [];
        let hasComplex = false;
        try {
          const source = await Bun.file(args.path).text();
          const result2 = parseASExports(source);
          parsedExports = result2.exports;
          if (result2.warnings.length > 0) {
            console.warn(`[bun-assemblyscript] ${result2.warnings.length} warning(s) dans ${basename2(args.path)} :`, result2.warnings.map((w) => w.message).join(", "));
          }
          await generateDts(parsedExports, args.path);
          hasComplex = hasComplexExports(parsedExports);
        } catch (err) {
          console.warn("[bun-assemblyscript] G\xE9n\xE9ration de types \xE9chou\xE9e :", err);
        }
        const compilerOptions = {
          optimizeLevel: isProd ? 3 : 0,
          shrinkLevel: isProd ? 2 : 0,
          runtime: hasComplex ? "incremental" : "stub",
          sourceMap: !isProd,
          debug: !isProd,
          ...compilerOverrides
        };
        let result;
        try {
          result = await compileWithTimeout(args.path, compilerOptions, compileTimeout);
        } catch (err) {
          return {
            contents: "",
            errors: [{ text: String(err) }]
          };
        }
        if (!result.success || !result.wasmBytes) {
          return {
            contents: "",
            errors: result.errors.map((text) => ({ text }))
          };
        }
        if (!isProd && result.sourceMapBytes) {
          await writeSourceMap(args.path, result.sourceMapBytes, cwd);
        }
        const resolvedMode = embedMode === "auto" ? result.wasmBytes.length < 1e5 ? "inline" : "file" : embedMode;
        const exportsMap = await instantiate(result.wasmBytes);
        const exportNames = Object.keys(exportsMap).filter((k) => k !== "__data_end" && k !== "__heap_base" && k !== "__memory" && k !== "memory");
        if (resolvedMode === "inline") {
          const b64 = Buffer.from(result.wasmBytes).toString("base64");
          return {
            contents: generateModule({
              exportNames,
              parsedExports,
              wasmSource: b64,
              isInline: true
            }),
            loader: "js"
          };
        }
        const outdir = build.config?.outdir ?? "./dist";
        const wasmHash = createHash2("sha256").update(result.wasmBytes).digest("hex").substring(0, 8);
        const fileName = `module-${wasmHash}.wasm`;
        const outPath = join(cwd, outdir, fileName);
        try {
          await mkdir(join(cwd, outdir), { recursive: true });
          await Bun.write(outPath, result.wasmBytes);
        } catch (err) {
          console.warn("[bun-assemblyscript] \xC9criture du .wasm \xE9chou\xE9e :", err);
        }
        return {
          contents: generateModule({
            exportNames,
            parsedExports,
            wasmSource: `./${fileName}`,
            isInline: false
          }),
          loader: "js"
        };
      });
    }
  };
}
export {
  instantiate,
  assemblyScriptPlugin as default,
  compile,
  assemblyScriptPlugin,
  AbortError
};
