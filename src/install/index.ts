import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { patchTsConfig } from "./tsconfig";
import { patchBunfig } from "./bunfig";
import { patchVsCode } from "./vscode";
import { Glob } from "bun";

async function run() {
  // En mode postinstall NPM/Bun, INIT_CWD pointe vers le dossier du projet final installant le package
  const hostRoot = process.env.INIT_CWD || process.cwd();
  
  // Anti-boucle : si on est dans le dépôt originel de dev, on limite certains comportements
  const isSelf = hostRoot === process.cwd() && existsSync(join(hostRoot, "src", "compiler.ts"));

  console.log("");
  console.log("\x1b[36m┌──────────────────────────────────────────────┐\x1b[0m");
  console.log("\x1b[36m│                                              │\x1b[0m");
  console.log("\x1b[36m│    \x1b[1m🚀 Installation bun-assemblyscript\x1b[0;36m        │\x1b[0m");
  console.log("\x1b[36m│                                              │\x1b[0m");

  const results = {
    ascParams: false,
    bunfig: false,
    globalDts: false,
    tsconfig: false,
    vscode: false,
    example: false,
  };

  try {
    // 1. Détecter assemblyscript
    const pkgPath = join(hostRoot, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = await Bun.file(pkgPath).json();
      const hasAsc =
        (pkg.dependencies && pkg.dependencies.assemblyscript) ||
        (pkg.devDependencies && pkg.devDependencies.assemblyscript);
      if (hasAsc) {
        results.ascParams = true;
      } else {
        console.log(
          "\x1b[33m[!] Warning: 'assemblyscript' n'est pas installé dans votre projet.\x1b[0m"
        );
        console.log(
          "\x1b[33m    => Lancez : bun add -d assemblyscript\x1b[0m\n"
        );
      }
    }

    // 2. bunfig.toml
    await patchBunfig(hostRoot);
    results.bunfig = true;

    // 3. assemblyscript.d.ts (global)
    const globalDest = join(hostRoot, "assemblyscript.d.ts");
    if (!existsSync(globalDest) && !isSelf) {
      // Résout depuis __dirname vers src/typegen/global.d.ts
      const sourceGlobal = join(__dirname, "..", "typegen", "global.d.ts");
      try {
        const content = await Bun.file(sourceGlobal).text();
        await Bun.write(globalDest, content);
      } catch (e) {}
    }
    results.globalDts = true;

    // 4. tsconfig.json
    try {
      await patchTsConfig(hostRoot);
      results.tsconfig = true;
    } catch (e) {}

    // 5. VSCode Integration
    try {
      await patchVsCode(hostRoot, isSelf);
      results.vscode = true;
    } catch (e) {}

    // 6. Créer example.as s'il n'y a pas de fichier .as dans le projet
    let hasAsFile = false;
    const asGlob = new Glob("**/*.as");
    for (const file of asGlob.scanSync({ cwd: hostRoot })) {
      if (!file.includes("node_modules") && !file.includes(".cache")) {
        hasAsFile = true;
        break;
      }
    }

    let createdExample = false;
    if (!hasAsFile && !isSelf) {
      const wasmDir = join(hostRoot, "src", "wasm");
      if (!existsSync(wasmDir)) {
        mkdirSync(wasmDir, { recursive: true });
      }

      const asFile = join(wasmDir, "example.as");
      const asCode = `// Exemple de fonction AssemblyScript
export function add(a: i32, b: i32): i32 {
  return a + b;
}
`;
      await Bun.write(asFile, asCode);

      const tsFile = join(wasmDir, "example.ts");
      const tsCode = `import { add } from "./example.as";

console.log("AssemblyScript add(10, 20) =", add(10, 20));
`;
      await Bun.write(tsFile, tsCode);

      createdExample = true;
    }
    results.example = true;

    // Formatter de résultat [✓] et [✗]
    const check = (ok: boolean) => (ok ? "\x1b[32m✓\x1b[36m" : "\x1b[31m✗\x1b[36m");

    console.log("\x1b[36m│  " + check(results.ascParams) + " Vérification dépendance AssemblyScript   │\x1b[0m");
    console.log("\x1b[36m│  " + check(results.bunfig) + " Configuration automatique bunfig.toml    │\x1b[0m");
    console.log("\x1b[36m│  " + check(results.globalDts) + " Copie de assemblyscript.d.ts global      │\x1b[0m");
    console.log("\x1b[36m│  " + check(results.tsconfig) + " Configuration auto tsconfig.json         │\x1b[0m");
    console.log("\x1b[36m│  " + check(results.vscode) + " Intégration VSCode (.vscode)               │\x1b[0m");
    console.log("\x1b[36m│  " + check(results.example) + (createdExample ? " Fichier d'exemple généré                 " : " Projet contenant déjà des fichiers .as   ") + "│\x1b[0m");
    console.log("\x1b[36m│                                              │\x1b[0m");
    console.log("\x1b[36m└──────────────────────────────────────────────┘\x1b[0m\n");

    if (createdExample) {
      console.log(
        "\x1b[1m\x1b[32mInstallation réussie !\x1b[0m Testez l'exemple avec la commande ci-dessous :\n"
      );
      console.log("  \x1b[36mbun run src/wasm/example.ts\x1b[0m\n");
    } else {
      console.log(
        "\x1b[1m\x1b[32mInstallation réussie !\x1b[0m Votre projet est prêt.\n"
      );
    }
  } catch (err) {
    console.error("\x1b[31m[bun-as] Erreur pendant l'installation:\x1b[0m", err);
    process.exit(1);
  }
}

run().catch(() => process.exit(0));
