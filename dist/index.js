var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// index.ts
var exports_bun_assemblyScript = {};
__export(exports_bun_assemblyScript, {
  instantiate: () => instantiate,
  default: () => assemblyScriptPlugin,
  compile: () => compile,
  assemblyScriptPlugin: () => assemblyScriptPlugin,
  AbortError: () => AbortError
});
module.exports = __toCommonJS(exports_bun_assemblyScript);

// src/compiler.ts
var import_path = require("path");
var import_os = require("os");
function resolveAscJs(cwd) {
  const candidates = [
    import_path.resolve(cwd, "node_modules", "assemblyscript", "bin", "asc.js"),
    import_path.resolve(cwd, "..", "node_modules", "assemblyscript", "bin", "asc.js")
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
  const source = await Bun.file(asFilePath).text();
  const baseName = import_path.basename(asFilePath, ".as");
  const tmpPath = import_path.resolve(import_os.tmpdir(), `asc_bridge_${baseName}_${Date.now()}.ts`);
  await Bun.write(tmpPath, source);
  return tmpPath;
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
      options.runtime ?? "stub"
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
      return { success: false, wasmBytes: null, sourceMapBytes: null, errors };
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
        errors: [...errors, "Aucun output WASM produit par asc."]
      };
    }
    return { success: true, wasmBytes, sourceMapBytes, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(message);
    return { success: false, wasmBytes: null, sourceMapBytes: null, errors };
  } finally {
    const fs = await import("fs/promises");
    for (const tmpFile of [tsBridgePath, outWasmPath, outWasmPath ? outWasmPath + ".map" : null]) {
      if (tmpFile) {
        try {
          await fs.unlink(tmpFile);
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
function readASString(memory, ptr) {
  if (ptr === 0)
    return "";
  const buf = memory.buffer;
  const dataView = new DataView(buf);
  const byteLength = dataView.getInt32(ptr - 4, true);
  const length = byteLength >>> 1;
  if (length <= 0 || ptr + byteLength > buf.byteLength)
    return "";
  const u16 = new Uint16Array(buf, ptr, length);
  return String.fromCharCode(...u16);
}
async function instantiate(wasmBytes) {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const imports = {
    env: {
      memory,
      abort(msgPtr, filePtr, line, col) {
        const message = readASString(memory, msgPtr);
        const file = readASString(memory, filePtr);
        throw new AbortError(`AbortError: ${message || "(no message)"} — ${file || "(unknown file)"}:${line}:${col}`, file, line, col);
      }
    }
  };
  const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
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
function extractClassBody(text, startIndex) {
  let depth = 0;
  let inClass = false;
  let bodyStart = -1;
  const length = text.length;
  for (let i = startIndex;i < length; i++) {
    const char = text[i];
    if (char === "{") {
      if (depth === 0) {
        inClass = true;
        bodyStart = i + 1;
      }
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && inClass) {
        return text.substring(bodyStart, i);
      }
    }
  }
  return "";
}
function parseASExports(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  const exports2 = [];
  const fnRegex = /export\s+function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*:\s*([^;{]+)/g;
  let match;
  while ((match = fnRegex.exec(text)) !== null) {
    const name = match[1];
    const paramsStr = match[2];
    const returnType = match[3].trim();
    const params = paramsStr.split(",").filter((p) => p.trim()).map((p) => {
      const parts = p.split(":");
      return {
        name: parts[0].trim(),
        type: parts.length > 1 ? parts[1].trim() : "unknown"
      };
    });
    exports2.push({ kind: "function", name, params, returnType });
  }
  const constRegex = /export\s+const\s+([a-zA-Z0-9_]+)\s*:\s*([^=;]+)/g;
  while ((match = constRegex.exec(text)) !== null) {
    exports2.push({ kind: "const", name: match[1], type: match[2].trim() });
  }
  const classRegex = /export\s+class\s+([a-zA-Z0-9_]+)/g;
  while ((match = classRegex.exec(text)) !== null) {
    const className = match[1];
    const body = extractClassBody(text, match.index);
    const methods = [];
    const methodRegex = /(?:public\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*:\s*([^;{]+)/g;
    let mMatch;
    while ((mMatch = methodRegex.exec(body)) !== null) {
      const mName = mMatch[1];
      if (mName === "constructor")
        continue;
      const mParamsStr = mMatch[2];
      const mReturnType = mMatch[3].trim();
      const mParams = mParamsStr.split(",").filter((p) => p.trim()).map((p) => {
        const parts = p.split(":");
        return {
          name: parts[0].trim(),
          type: parts.length > 1 ? parts[1].trim() : "unknown"
        };
      });
      methods.push({
        kind: "function",
        name: mName,
        params: mParams,
        returnType: mReturnType
      });
    }
    exports2.push({ kind: "class", name: className, methods });
  }
  return exports2;
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
async function generateDts(exports2, sourcePath) {
  const lines = [
    "// auto-generated by bun-plugin-assemblyscript — do not edit",
    ""
  ];
  for (const exp of exports2) {
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
  const newHash = Bun.hash(dtsContent);
  try {
    const existingContent = await Bun.file(dtsPath).text();
    const oldHash = Bun.hash(existingContent);
    if (newHash === oldHash) {
      return;
    }
  } catch (err) {}
  await Bun.write(dtsPath, dtsContent);
}

// src/plugin.ts
var import_path2 = require("path");
var import_fs = require("fs");
function isBuildMode(build) {
  return build.config !== undefined && typeof build.config.target === "string" && build.config.target.length > 0 && false;
}
function isComplexType(t) {
  const trim = t.trim();
  return trim === "string" || trim === "String" || trim.includes("Array") || trim.includes("Map");
}
function hasComplexExports(exports2) {
  for (const exp of exports2) {
    if (exp.kind === "class")
      return true;
    if (exp.type && isComplexType(exp.type))
      return true;
    if (exp.params && exp.params.some((p) => isComplexType(p.type)))
      return true;
    if (exp.returnType && isComplexType(exp.returnType))
      return true;
    if (exp.methods && hasComplexExports(exp.methods))
      return true;
  }
  return false;
}
function generateInlineModule(exportNames, wasmBase64) {
  const lines = [
    `// Auto-generated by bun-plugin-assemblyscript (inline)`,
    `const __b64 = ${JSON.stringify(wasmBase64)};`,
    `const __bin = Uint8Array.from(atob(__b64), (c) => c.charCodeAt(0));`,
    `const __memory = new WebAssembly.Memory({ initial: 1 });`,
    `function __readStr(mem, ptr) {`,
    `  if (ptr === 0) return "";`,
    `  const dv = new DataView(mem.buffer);`,
    `  const len = dv.getInt32(ptr - 4, true) >>> 1;`,
    `  if (len <= 0) return "";`,
    `  return String.fromCharCode(...new Uint16Array(mem.buffer, ptr, len));`,
    `}`,
    `const __imports = {`,
    `  env: {`,
    `    memory: __memory,`,
    `    abort(msg, file, line, col) {`,
    `      const m = __readStr(__memory, msg);`,
    `      const f = __readStr(__memory, file);`,
    `      throw new Error(\`AbortError: \${m || "(no)"} — \${f}:\${line}:\${col}\`);`,
    `    }`,
    `  }`,
    `};`,
    `const { instance: __inst } = await WebAssembly.instantiate(__bin, __imports);`
  ];
  for (const name of exportNames) {
    lines.push(`export const ${name} = __inst.exports.${name};`);
  }
  return lines.join(`
`) + `
`;
}
function generateFileModule(exportNames, wasmUrl) {
  const lines = [
    `// Auto-generated by bun-plugin-assemblyscript (file)`,
    `const __url = ${JSON.stringify(wasmUrl)};`,
    `const __res = await fetch(__url);`,
    `const __bin = new Uint8Array(await __res.arrayBuffer());`,
    `const __memory = new WebAssembly.Memory({ initial: 1 });`,
    `function __readStr(mem, ptr) {`,
    `  if (ptr === 0) return "";`,
    `  const dv = new DataView(mem.buffer);`,
    `  const len = dv.getInt32(ptr - 4, true) >>> 1;`,
    `  if (len <= 0) return "";`,
    `  return String.fromCharCode(...new Uint16Array(mem.buffer, ptr, len));`,
    `}`,
    `const __imports = {`,
    `  env: {`,
    `    memory: __memory,`,
    `    abort(msg, file, line, col) {`,
    `      const m = __readStr(__memory, msg);`,
    `      const f = __readStr(__memory, file);`,
    `      throw new Error(\`AbortError: \${m || "(no)"} — \${f}:\${line}:\${col}\`);`,
    `    }`,
    `  }`,
    `};`,
    `const { instance: __inst } = await WebAssembly.instantiate(__bin, __imports);`
  ];
  for (const name of exportNames) {
    lines.push(`export const ${name} = __inst.exports.${name};`);
  }
  return lines.join(`
`) + `
`;
}
function assemblyScriptPlugin(options = {}) {
  return {
    name: "bun-plugin-assemblyscript",
    async setup(build) {
      let embedMode = "auto";
      try {
        if (import_fs.existsSync("bunfig.toml")) {
          const config = await Bun.file("bunfig.toml").text();
          const match = config.match(/embedMode\s*=\s*(?:"|')([^"']+)(?:"|')/);
          if (match)
            embedMode = match[1];
        }
      } catch (e) {}
      const isProd = isBuildMode(build) || false || build.config?.minify;
      build.onLoad({ filter: /\.as$/ }, async (args) => {
        let parsedExports = [];
        let hasComplex = false;
        try {
          const source = await Bun.file(args.path).text();
          parsedExports = parseASExports(source);
          await generateDts(parsedExports, args.path);
          hasComplex = hasComplexExports(parsedExports);
        } catch (e) {
          console.warn("[bun-assemblyscript] Génération de types échouée :", e);
        }
        const compilerOptions = {
          optimizeLevel: isProd ? 3 : 0,
          shrinkLevel: isProd ? 2 : 0,
          runtime: hasComplex ? "incremental" : "stub",
          sourceMap: !isProd,
          debug: !isProd,
          ...options.compilerOverrides
        };
        const result = await compile(args.path, compilerOptions);
        if (!result.success || !result.wasmBytes) {
          return {
            contents: "",
            errors: result.errors.map((text) => ({ text }))
          };
        }
        if (!isProd && result.sourceMapBytes) {
          const cacheDir = import_path2.join(process.cwd(), ".cache", "bun-as", require("path").basename(args.path));
          const currentHash = require("crypto").createHash("sha256").update(await Bun.file(args.path).text()).digest("hex");
          const mapPath = import_path2.join(cacheDir, currentHash + ".wasm.map");
          try {
            await require("fs/promises").mkdir(cacheDir, { recursive: true });
            await Bun.write(mapPath, result.sourceMapBytes);
          } catch (e) {}
        }
        let finalMode = embedMode;
        if (finalMode === "auto") {
          finalMode = result.wasmBytes.length < 1e5 ? "inline" : "file";
        }
        const exportsMap = await instantiate(result.wasmBytes);
        const exportNames = Object.keys(exportsMap).filter((k) => k !== "__data_end" && k !== "__heap_base");
        if (finalMode === "inline") {
          const b64 = Buffer.from(result.wasmBytes).toString("base64");
          return { contents: generateInlineModule(exportNames, b64), loader: "js" };
        } else {
          const outdir = build.config?.outdir || "./dist";
          const fileName = "module-" + Bun.hash(result.wasmBytes) + ".wasm";
          const outPath = import_path2.join(process.cwd(), outdir, fileName);
          try {
            await require("fs/promises").mkdir(import_path2.join(process.cwd(), outdir), { recursive: true });
            await Bun.write(outPath, result.wasmBytes);
          } catch (e) {}
          const wasmUrl = "./" + fileName;
          return { contents: generateFileModule(exportNames, wasmUrl), loader: "js" };
        }
      });
    }
  };
}
