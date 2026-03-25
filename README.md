# bun-assemblyscript

[![npm version](https://badge.fury.io/js/bun-assemblyscript.svg)](https://badge.fury.io/js/bun-assemblyscript)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why
L'intégration de WebAssembly dans Bun est souvent complexe et nécessite des étapes de compilation manuelles. Ce plugin automatise tout le processus en traitant les fichiers `.as` comme des modules natifs. Écrivez en AssemblyScript, importez directement dans Bun, et profitez d'une performance optimale sans friction.

## Install

```bash
bun add -d bun-assemblyscript assemblyscript
```

## Usage

```typescript
import { add } from "./math.as";
console.log(add(10, 20)); // 30
```

## How it works
Le plugin gère automatiquement le cycle de vie de vos fichiers :
`.as → asc → .wasm → .d.ts → import natif`

## Configuration
Personnalisez le comportement via les options suivantes :
- `embedMode` : Contrôle comment le binaire WASM est intégré (ex: `inline`).
- `runtime` : Choix du runtime AssemblyScript (`stub`, `minimal`, `full`).
- `optimizeLevel` : Niveau d'optimisation (0 à 3) appliqué par le compilateur.

## Roadmap
Notre priorité absolue est de fournir une **intégration CLI Bun** native, permettant une gestion encore plus fluide des projets AssemblyScript directement depuis les commandes standards de Bun.
