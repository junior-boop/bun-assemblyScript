import { join } from "path";
import { existsSync } from "fs";

/**
 * Lit le bunfig.toml du projet hôte et injecte "bun-plugin-assemblyscript"
 * dans le tableau preload s'il n'est pas déjà présent.
 * 
 * @param projectRoot Chemin racine du projet hôte
 * @returns boolean indiquant si le fichier a été modifié
 */
export async function patchBunfig(projectRoot: string): Promise<boolean> {
  const bunfigPath = join(projectRoot, "bunfig.toml");
  let content = "";
  let changed = false;

  if (existsSync(bunfigPath)) {
    content = await Bun.file(bunfigPath).text();
    
    // Si déjà présent, on ne fait rien pour ne pas dupliquer
    if (!content.includes("bun-plugin-assemblyscript")) {
      const preloadRegex = /preload\s*=\s*\[(.*?)\]/s;
      const match = content.match(preloadRegex);
      
      if (match) {
        const inner = match[1].trim();
        const addition = inner.length > 0 ? `, "bun-plugin-assemblyscript"` : `"bun-plugin-assemblyscript"`;
        content = content.replace(preloadRegex, `preload = [${inner}${addition}]`);
        changed = true;
      } else {
        content += `\npreload = ["bun-plugin-assemblyscript"]\n`;
        changed = true;
      }
    }
  } else {
    // Fichier absent : on créé une version vierge minimale
    content = `preload = ["bun-plugin-assemblyscript"]\n`;
    changed = true;
  }

  if (changed) {
    await Bun.write(bunfigPath, content);
  }
  
  return changed;
}
