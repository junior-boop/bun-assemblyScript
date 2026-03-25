import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export async function patchVsCode(hostRoot: string, isSelf: boolean) {
  // Optionnel: on ne le fait pas si on est dans notre propre repo de dev, sauf si demandé.
  // Mais c'est pratique de l'avoir même en dev. On va l'exécuter dans tous les cas.
  
  const vscodeDir = join(hostRoot, ".vscode");
  if (!existsSync(vscodeDir)) {
    mkdirSync(vscodeDir, { recursive: true });
  }

  // 6.1 settings.json
  const settingsPath = join(vscodeDir, "settings.json");
  let settings: any = {};
  if (existsSync(settingsPath)) {
    try {
      settings = await Bun.file(settingsPath).json();
    } catch (e) {
      // Ignorer si le JSON est invalide
    }
  }
  if (!settings["files.associations"]) {
    settings["files.associations"] = {};
  }
  settings["files.associations"]["*.as"] = "typescript";
  await Bun.write(settingsPath, JSON.stringify(settings, null, 2));

  // 6.2 as.code-snippets
  const snippetsPath = join(vscodeDir, "as.code-snippets");
  const snippets = {
    "AssemblyScript Export": {
      "prefix": "asexport",
      "scope": "typescript",
      "body": [
        "export function ${1:name}(${2:a}: ${3:i32}): ${4:i32} {",
        "  $0",
        "}"
      ],
      "description": "Exported function for AssemblyScript"
    },
    "AssemblyScript Class": {
      "prefix": "asclass",
      "scope": "typescript",
      "body": [
        "export class ${1:Name} {",
        "  constructor() {",
        "    $0",
        "  }",
        "}"
      ],
      "description": "Exported class with constructor for AssemblyScript"
    },
    "AssemblyScript Import": {
      "prefix": "asimport",
      "scope": "typescript",
      "body": [
        "import { ${2:func} } from \"${1:./module.as}\";$0"
      ],
      "description": "Import pattern from an .as file"
    }
  };
  await Bun.write(snippetsPath, JSON.stringify(snippets, null, 2));

  // 6.3 extensions.json
  const extensionsPath = join(vscodeDir, "extensions.json");
  let extensions: any = {};
  if (existsSync(extensionsPath)) {
    try {
      extensions = await Bun.file(extensionsPath).json();
    } catch (e) {}
  }
  if (!extensions.recommendations) {
    extensions.recommendations = [];
  }
  if (!extensions.recommendations.includes("saulecabrera.vscode-assemblyscript")) {
    extensions.recommendations.push("saulecabrera.vscode-assemblyscript");
  }
  await Bun.write(extensionsPath, JSON.stringify(extensions, null, 2));
}
