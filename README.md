# bun-assemblyscript

[![npm version](https://badge.fury.io/js/bun-assemblyscript.svg)](https://badge.fury.io/js/bun-assemblyscript)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Importez des fichiers AssemblyScript (`.as`) directement dans vos projets Bun — comme des modules classiques.

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

## Démarrage rapide

### Étape 1 — Créer le preload

```typescript
// preload.ts
import { plugin } from "bun";
import { assemblyScriptPlugin } from "bun-assemblyscript";

plugin(assemblyScriptPlugin());
```

### Étape 2 — Configurer bunfig.toml

```toml
[run]
preload = ["./preload.ts"]

[test]
preload = ["./preload.ts"]
```

### Étape 3 — Écrire du code AssemblyScript

```typescript
// math.as
export function add(a: i32, b: i32): i32 {
  return (a + b) as i32;
}

export function multiply(a: i32, b: i32): i32 {
  return (a * b) as i32;
}
```

### Étape 4 — Importer normalement

```typescript
// index.ts
import { add, multiply } from "./math.as";

console.log(add(2, 3));      // 5
console.log(multiply(4, 5)); // 20
```

```bash
bun run index.ts
```

---

## Modes d'utilisation

### Preload (recommandé)

Le plugin se charge automatiquement au démarrage de Bun grâce à `bunfig.toml`.

```toml
[run]
preload = ["./preload.ts"]
```

Tous vos fichiers `.as` sont alors importables partout.

### Programmatique avec `bun build`

```typescript
import { Bun } from "bun";
import { assemblyScriptPlugin } from "bun-assemblyscript";

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  plugins: [assemblyScriptPlugin()],
});
```

Le plugin détecte automatiquement le mode build et applique les optimisations maximales (`optimizeLevel: 3`, `runtime: "minimal"`, pas de debug).

### API directe du compilateur

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

## Configuration

```typescript
import { assemblyScriptPlugin } from "bun-assemblyscript";

plugin(
  assemblyScriptPlugin({
    compilerOverrides: {
      optimizeLevel: 2,
      runtime: "stub",
      sourceMap: true,
      debug: false,
    },
  })
);
```

| Option | Type | Dev | Build | Description |
|--------|------|-----|-------|-------------|
| `optimizeLevel` | `0 \| 1 \| 2 \| 3` | `0` | `3` | Niveau d'optimisation |
| `runtime` | `string` | `"stub"` | `"minimal"` | Runtime AssemblyScript |
| `sourceMap` | `boolean` | `false` | `false` | Générer les source maps |
| `debug` | `boolean` | `true` | `false` | Mode debug |
| `shrinkLevel` | `0 \| 1 \| 2` | `0` | `2` | Niveau de réduction de taille |

---

## API

### `assemblyScriptPlugin(options?): BunPlugin`

Crée le plugin Bun.

```typescript
import { assemblyScriptPlugin } from "bun-assemblyscript";

plugin(assemblyScriptPlugin());
```

### `compile(filename, options?): Promise<CompilerResult>`

Compile un fichier `.as` en bytes WASM.

```typescript
const result = await compile("./math.as", { optimizeLevel: 3 });

// result.success       : boolean
// result.wasmBytes     : Uint8Array | null
// result.sourceMapBytes: Uint8Array | null
// result.errors        : string[]
```

### `instantiate(wasmBytes): Promise<ASExports>`

Instancie un module WASM avec les imports AssemblyScript requis (`env.memory`, `env.abort`).

```typescript
const exports = await instantiate(wasmBytes);
exports.add(2, 3); // 5
```

Retourne un objet plat — chaque fonction exportée nommément, pas `instance.exports` brut.

### `AbortError`

Erreur levée quand le code AssemblyScript appelle `abort()`.

```typescript
import { AbortError } from "bun-assemblyscript";

try {
  exports.divide(1, 0);
} catch (e) {
  if (e instanceof AbortError) {
    console.error(e.message); // "AbortError: ... — file.as:10:5"
    console.error(e.file);    // "file.as"
    console.error(e.line);    // 10
    console.error(e.column);  // 5
  }
}
```

---

## Pipeline interne

```
fichier .as
    │
    ▼
┌──────────┐  .as → .ts bridge  ┌─────┐
│ compiler │ ──────────────────▶ │ asc │
└──────────┘                     └──┬──┘
                                    │
                               bytes WASM
                                    │
    ┌───────────────────────────────┘
    ▼
┌──────────────┐  découvrir exports  ┌────────┐
│ instantiator │ ◀────────────────── │ plugin │
└──────┬───────┘                     └───┬────┘
       │                                 │
  ASExports                         module JS inline
  (objet plat)                    ┌─────────────────┐
                                  │ const wasm = …  │
                                  │ const inst = …  │
                                  │ export const …  │
                                  └─────────────────┘
```

---

## Tests

```bash
bun test
```

La configuration `bunfig.toml` charge le preload automatiquement pour les tests.

---

## Limitations

- Imports AssemblyScript (`import ... from "..."`) dans les fichiers `.as` non supportés
- Seuls les types numériques (`i32`, `f64`, etc.) sont directement exportés
- `sourceMap` nécessite un runtime compatible

---

## License

MIT
