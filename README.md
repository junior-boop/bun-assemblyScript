# bun-assemblyscript

[![npm version](https://badge.fury.io/js/bun-assemblyscript.svg)](https://badge.fury.io/js/bun-assemblyscript)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Plugin Bun pour importer des fichiers [AssemblyScript](https://www.assemblyscript.org/) (`.as`) directement dans vos projets — comme des modules TypeScript classiques.

```typescript
import { add } from "./math.as";
console.log(add(2, 3)); // 5
```

---

## Installation

```bash
bun add -d bun-assemblyscript assemblyscript
```

---

## Utilisation

### 1. Preload (recommandé pour `bun run` et `bun test`)

Créez un fichier `preload.ts` à la racine du projet :

```typescript
// preload.ts
import { plugin } from "bun";
import { assemblyScriptPlugin } from "bun-assemblyscript";

plugin(assemblyScriptPlugin());
```

Ajoutez-le dans `bunfig.toml` :

```toml
[run]
preload = ["./preload.ts"]

[test]
preload = ["./preload.ts"]
```

Ensuite, importez vos fichiers `.as` n'importe où :

```typescript
// src/app.ts
import { add, multiply } from "./math.as";

console.log(add(2, 3));      // 5
console.log(multiply(4, 5)); // 20
```

### 2. Programmatique avec `bun build`

```typescript
// build.ts
import { Bun } from "bun";
import { assemblyScriptPlugin } from "bun-assemblyscript";

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  plugins: [assemblyScriptPlugin()],
});
```

```bash
bun run build.ts
```

### 3. Utilisation directe du compilateur

```typescript
import { compile, instantiate } from "bun-assemblyscript";

const result = await compile("./math.as", {
  optimizeLevel: 3,
  runtime: "stub",
});

if (result.success && result.wasmBytes) {
  const exports = await instantiate(result.wasmBytes);
  console.log(exports.add(2, 3)); // 5
}
```

---

## Fichier `.as` exemple

```typescript
// math.as
export function add(a: i32, b: i32): i32 {
  return a + b;
}

export function multiply(a: i32, b: i32): i32 {
  return a * b;
}

export function subtract(a: i32, b: i32): i32 {
  return a - b;
}
```

---

## Configuration

### Options du plugin

```typescript
import { assemblyScriptPlugin } from "bun-assemblyscript";

plugin(
  assemblyScriptPlugin({
    compilerOverrides: {
      optimizeLevel: 3,   // 0 | 1 | 2 | 3
      runtime: "minimal", // "minimal" | "stub" | "full"
      sourceMap: true,
      debug: false,
    },
  })
);
```

| Option | Type | Défaut | Description |
|--------|------|--------|-------------|
| `optimizeLevel` | `0 \| 1 \| 2 \| 3` | `0` (dev) / `3` (build) | Niveau d'optimisation de `asc` |
| `runtime` | `string` | `"stub"` (dev) / `"minimal"` (build) | Runtime AssemblyScript |
| `sourceMap` | `boolean` | `false` | Générer les source maps |
| `debug` | `boolean` | `true` (dev) / `false` (build) | Mode debug |

### Détection automatique du mode

Le plugin détecte automatiquement le contexte :

| Contexte | Mode | optimizeLevel | runtime | debug |
|----------|------|---------------|---------|-------|
| `bun run` / `bun test` | dev | `0` | `"stub"` | `true` |
| `bun build` | prod | `3` | `"minimal"` | `false` |

---

## API Reference

### `assemblyScriptPlugin(options?): BunPlugin`

Crée le plugin Bun pour AssemblyScript.

```typescript
import { assemblyScriptPlugin } from "bun-assemblyscript";

const myPlugin = assemblyScriptPlugin({
  compilerOverrides: { optimizeLevel: 2 },
});
```

### `compile(filename, options?): Promise<CompilerResult>`

Compile un fichier `.as` en bytes WASM.

```typescript
import { compile } from "bun-assemblyscript";

const result = await compile("./math.as", {
  optimizeLevel: 3,
  runtime: "stub",
});

// result.success: boolean
// result.wasmBytes: Uint8Array | null
// result.errors: string[]
```

### `instantiate(wasmBytes): Promise<ASExports>`

Instancie un module WASM avec les imports AssemblyScript requis.

```typescript
import { instantiate } from "bun-assemblyscript";

const exports = await instantiate(wasmBytes);
exports.add(2, 3); // 5
```

Retourne un objet plat avec chaque fonction exportée nommément.

### `AbortError`

Erreur levée quand le code AssemblyScript appelle `abort()`.

```typescript
import { AbortError } from "bun-assemblyscript";

try {
  exports.someFunction();
} catch (e) {
  if (e instanceof AbortError) {
    console.error(e.message); // "AbortError: ... — file.as:10:5"
    console.error(e.line);    // 10
    console.error(e.column);  // 5
  }
}
```

---

## Tests

```bash
bun test
```

Le fichier `bunfig.toml` configure le preload automatiquement pour les tests :

```toml
[test]
preload = ["./preload.ts"]
```

---

## Comment ça marche

```
  .as file
     │
     ▼
┌──────────┐    .as → .ts bridge    ┌─────────┐
│ compiler │ ──────────────────────▶ │   asc   │
│   .ts    │    (asc v0.28 need     │ (node)  │
└──────────┘     .ts extension)     └────┬────┘
                                         │
                                    .wasm bytes
                                         │
     ┌───────────────────────────────────┘
     ▼
┌──────────────┐   discover exports   ┌──────────────┐
│ instantiator │ ◀─────────────────── │   plugin.ts  │
└──────┬───────┘                      └──────┬───────┘
       │                                     │
  ASExports                             inline JS module
  (flat object)                        ┌─────────────────┐
                                       │ const wasm = …  │
                                       │ const inst = …  │
                                       │ export const …  │
                                       └─────────────────┘
```

---

## Limitations

- Les imports AssemblyScript (`import ... from "..."`) dans les fichiers `.as` ne sont pas encore supportés
- Le mode `sourceMap` nécessite un runtime compatible
- Seuls les types numériques (`i32`, `f64`, etc.) sont directement exportés

---

## License

MIT
