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

Cela installe :
- `bun-assemblyscript` — le plugin Bun
- `assemblyscript` — le compilateur AssemblyScript (peer dependency)

---

## Démarrage rapide (4 étapes)

### 1. Créer le fichier preload

```typescript
// preload.ts
import { plugin } from "bun";
import { assemblyScriptPlugin } from "bun-assemblyscript";

plugin(assemblyScriptPlugin());
```

### 2. Configurer bunfig.toml

Créez (ou modifiez) `bunfig.toml` à la racine du projet :

```toml
[run]
preload = ["./preload.ts"]

[test]
preload = ["./preload.ts"]
```

Cela charge le plugin automatiquement avant chaque `bun run` et `bun test`.

### 3. Écrire du code AssemblyScript

```typescript
// math.as
export function add(a: i32, b: i32): i32 {
  return (a + b) as i32;
}

export function multiply(a: i32, b: i32): i32 {
  return (a * b) as i32;
}

export function subtract(a: i32, b: i32): i32 {
  return (a - b) as i32;
}
```

### 4. Importer et utiliser

```typescript
// index.ts
import { add, multiply, subtract } from "./math.as";

console.log(add(2, 3));      // 5
console.log(multiply(4, 5)); // 20
console.log(subtract(10, 3)); // 7
```

```bash
bun run index.ts
```

---

## Types supportés

### Types numériques (passage direct)

Les types numériques sont passés directement entre JavaScript et WebAssembly sans conversion :

```typescript
// math.as
export function add(a: i32, b: i32): i32 { return (a + b) as i32; }
export function compute(x: f64): f64 { return x * 2.0; }
```

```typescript
// index.ts
import { add, compute } from "./math.as";

add(2, 3);       // 5 (i32)
compute(3.14);   // 6.28 (f64)
```

Types numériques supportés : `i8`, `i16`, `i32`, `i64`, `u8`, `u16`, `u32`, `u64`, `f32`, `f64`, `isize`, `usize`, `bool`

### Types string (wrapper automatique)

Les fonctions qui utilisent `string` en paramètre ou en retour sont automatiquement wrappées par le plugin :

```typescript
// greeting.as
export function greet(name: string): string {
  return "Hello, " + name + "!";
}
```

```typescript
// index.ts
import { greet } from "./greeting.as";

greet("World"); // "Hello, World!"
```

Le plugin génère automatiquement les fonctions `__readStr` (lecture depuis WASM) et `__writeStr` (écriture vers WASM).

> **Note :** Le support des strings nécessite que le module WASM exporte `__new`. Le plugin ajoute automatiquement le flag `--exportRuntime` au compilateur pour cela.

---

## Modes d'utilisation

### Mode 1 — Preload (recommandé)

Le plugin se charge automatiquement au démarrage de Bun grâce à `bunfig.toml`.

```toml
[run]
preload = ["./preload.ts"]
```

Tous vos fichiers `.as` sont alors importables partout dans votre projet.

### Mode 2 — Programmatique avec Bun.build()

```typescript
import { assemblyScriptPlugin } from "bun-assemblyscript";

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  plugins: [assemblyScriptPlugin()],
});
```

Le plugin détecte automatiquement le mode build :
- **Dev** (`bun run`) : `optimizeLevel: 0`, `debug: true`, `sourceMap: true`
- **Build** (`bun build`) : `optimizeLevel: 3`, `debug: false`, `shrinkLevel: 2`

### Mode 3 — API directe du compilateur

Pour un contrôle total sans le plugin :

```typescript
import { compile, instantiate } from "bun-assemblyscript";

const result = await compile("./math.as", {
  optimizeLevel: 3,
  runtime: "stub",
  debug: false,
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
      optimizeLevel: 3,
      runtime: "stub",
      shrinkLevel: 1,
      sourceMap: false,
      debug: false,
    },
    compileTimeout: 30000,  // timeout en ms
    embedMode: "auto",      // "inline" | "file" | "auto"
  })
);
```

### Options du plugin

| Option | Type | Défaut | Description |
|--------|------|--------|-------------|
| `compilerOverrides` | `Partial<CompilerOptions>` | `{}` | Surcharger les options du compilateur |
| `compileTimeout` | `number` | `30000` | Timeout de compilation en ms |
| `embedMode` | `"inline" \| "file" \| "auto"` | `"auto"` | Comment embarquer le WASM |

### Options du compilateur

| Option | Type | Dev | Build | Description |
|--------|------|-----|-------|-------------|
| `optimizeLevel` | `0 \| 1 \| 2 \| 3` | `0` | `3` | Niveau d'optimisation |
| `shrinkLevel` | `0 \| 1 \| 2` | `0` | `2` | Niveau de réduction de taille |
| `runtime` | `string` | `"stub"` | `"stub"` | Runtime AssemblyScript |
| `sourceMap` | `boolean` | `true` | `false` | Générer les source maps |
| `debug` | `boolean` | `true` | `false` | Mode debug |

### Modes d'embedding

| Mode | Description |
|------|-------------|
| `"inline"` | Le WASM est encodé en base64 dans le module JS (défaut si < 100 Ko) |
| `"file"` | Le WASM est écrit dans un fichier séparé dans `outdir` |
| `"auto"` | Choisit automatiquement selon la taille |

---

## API Reference

### `assemblyScriptPlugin(options?): BunPlugin`

Crée le plugin Bun pour AssemblyScript.

```typescript
import { plugin } from "bun";
import { assemblyScriptPlugin } from "bun-assemblyscript";

plugin(assemblyScriptPlugin());
```

### `compile(filename, options?): Promise<CompilerResult>`

Compile un fichier `.as` en bytes WASM.

```typescript
import { compile } from "bun-assemblyscript";

const result = await compile("./math.as", {
  optimizeLevel: 3,
  runtime: "stub",
});

// result.success        : boolean
// result.wasmBytes      : Uint8Array | null
// result.sourceMapBytes : Uint8Array | null
// result.errors         : string[]
```

### `instantiate(wasmBytes): Promise<ASExports>`

Instancie un module WASM et retourne un objet plat avec les fonctions exportées.

```typescript
import { instantiate } from "bun-assemblyscript";

const exports = await instantiate(wasmBytes);
exports.add(2, 3); // 5
```

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

## Fonctionnement interne

```
  fichier .as
       │
       ▼
  ┌──────────┐    .as → .ts bridge    ┌─────┐
  │ compiler │ ──────────────────────▶ │ asc │
  └──────────┘  (asc v0.28 exige .ts) └──┬──┘
                                         │
                                    bytes WASM
                                         │
       ┌─────────────────────────────────┘
       ▼
  ┌──────────────┐   découvrir exports   ┌────────┐
  │ instantiator │ ◀──────────────────── │ plugin │
  └──────┬───────┘                       └───┬────┘
         │                                   │
    ASExports                            module JS inline
    (objet plat)                        ┌───────────────────┐
                                        │ const __bin = …   │
                                        │ const __inst = …  │
                                        │ export const add… │
                                        └───────────────────┘
```

### Étapes de compilation

1. **Pont .as → .ts** : asc v0.28 ne supporte que l'extension `.as`. Le plugin copie le fichier `.as` dans un fichier `.ts` temporaire.
2. **Compilation asc** : Le compilateur AssemblyScript est invoqué via `node asc.js` (Node est requis car asc utilise `WebAssembly.instantiateStreaming` non supporté par Bun).
3. **Découverte des exports** : Le module WASM est instancié pour découvrir les noms des fonctions exportées.
4. **Génération du module JS** : Un module JavaScript inline est généré avec le WASM embarqué en base64 et les wrappers pour les types string.
5. **Génération des types** : Un fichier `.d.ts` est généré à côté du `.as` pour l'autocomplétion dans l'éditeur.

---

## Tests

```bash
bun test
```

La configuration `bunfig.toml` charge le preload automatiquement :

```toml
[test]
preload = ["./preload.ts"]
```

---

## Limitations

- Les imports AssemblyScript (`import ... from "..."`) dans les fichiers `.as` ne sont pas supportés
- Seuls les types `string` et les types numériques sont supportés en paramètre/retour
- Les classes exportées sont parsées mais leur utilisation en runtime n'est pas encore implémentée
- Le compilateur nécessite Node.js installé (pour l'exécution de `asc.js`)

---

## License

MIT
