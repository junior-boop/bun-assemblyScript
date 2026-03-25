import { join } from "path";

/**
 * Nettoie une chaîne JSON de ses commentaires (// et \/\* \*\/)
 * afin de la rendre compatible avec JSON.parse().
 */
function stripJsonComments(jsonStr: string): string {
  return jsonStr.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
}

/**
 * Lit, nettoie et parse le \`tsconfig.json\` du projet hôte.
 * Fusionne les options pour inclure les dépendances gérées par le plugin.
 * Ne supprime pas les configurations existantes de l'utilisateur.
 * 
 * @param projectRoot Chemin vers la racine du projet hôte. (Par défaut \`process.cwd()\`)
 */
export async function patchTsConfig(projectRoot: string = process.cwd()): Promise<void> {
  const tsconfigPath = join(projectRoot, "tsconfig.json");
  let config: any = {};

  try {
    const rawContent = await Bun.file(tsconfigPath).text();
    config = JSON.parse(stripJsonComments(rawContent));
  } catch (err) {
    // Si absent ou invalide, on génère une configuration par défaut minimale
    config = {
      compilerOptions: {
        target: "ESNext",
        moduleResolution: "bundler",
      },
    };
  }

  // S'assurer que les clés minimales existent
  if (!config.compilerOptions) {
    config.compilerOptions = {};
  }
  // S'assurer que le tableau include existe à la racine
  if (!Array.isArray(config.include)) {
    if (config.include) config.include = [config.include];
    else config.include = [];
  }

  const includes: string[] = config.include;
  let changed = false;

  const requiredIncludes = ["assemblyscript.d.ts", "**/*.as.d.ts"];

  for (const req of requiredIncludes) {
    if (!includes.includes(req)) {
      includes.push(req);
      changed = true;
    }
  }

  if (changed) {
    // Écriture du fichier modifié
    await Bun.write(tsconfigPath, JSON.stringify(config, null, 2) + "\n");
  }
}
