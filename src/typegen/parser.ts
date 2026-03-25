export type ASExportKind = "function" | "const" | "class";

export interface ASParam {
  name: string;
  type: string;
}

export interface ASExport {
  name: string;
  kind: ASExportKind;
  params?: ASParam[];
  returnType?: string;
  type?: string;     // For constants
  methods?: ASExport[]; // For class methods
}

function extractClassBody(text: string, startIndex: number): string {
  let depth = 0;
  let inClass = false;
  let bodyStart = -1;
  const length = text.length;

  for (let i = startIndex; i < length; i++) {
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

/**
 * Parse un fichier source AssemblyScript (.as) et extrait les signatures publiques.
 * Gère "export function", "export const" et "export class".
 */
export function parseASExports(source: string): ASExport[] {
  // Nettoyer les commentaires ( /* ... */ et // ... )
  const text = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  const exports: ASExport[] = [];

  // Parsing des fonctions (hors des classes)
  const fnRegex = /export\s+function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*:\s*([^;{]+)/g;
  let match;
  while ((match = fnRegex.exec(text)) !== null) {
    const name = match[1];
    const paramsStr = match[2];
    const returnType = match[3].trim();

    const params: ASParam[] = paramsStr
      .split(",")
      .filter((p) => p.trim())
      .map((p) => {
        const parts = p.split(":");
        return {
          name: parts[0].trim(),
          type: parts.length > 1 ? parts[1].trim() : "unknown",
        };
      });

    exports.push({ kind: "function", name, params, returnType });
  }

  // Parsing des constantes (export const)
  const constRegex = /export\s+const\s+([a-zA-Z0-9_]+)\s*:\s*([^=;]+)/g;
  while ((match = constRegex.exec(text)) !== null) {
    exports.push({ kind: "const", name: match[1], type: match[2].trim() });
  }

  // Parsing des classes (export class)
  const classRegex = /export\s+class\s+([a-zA-Z0-9_]+)/g;
  while ((match = classRegex.exec(text)) !== null) {
    const className = match[1];
    const body = extractClassBody(text, match.index);

    const methods: ASExport[] = [];
    // Méthodes publiques de classe
    const methodRegex = /(?:public\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*:\s*([^;{]+)/g;
    let mMatch;
    while ((mMatch = methodRegex.exec(body)) !== null) {
      const mName = mMatch[1];
      if (mName === "constructor") continue;

      const mParamsStr = mMatch[2];
      const mReturnType = mMatch[3].trim();

      const mParams: ASParam[] = mParamsStr
        .split(",")
        .filter((p) => p.trim())
        .map((p) => {
          const parts = p.split(":");
          return {
            name: parts[0].trim(),
            type: parts.length > 1 ? parts[1].trim() : "unknown",
          };
        });

      methods.push({
        kind: "function",
        name: mName,
        params: mParams,
        returnType: mReturnType,
      });
    }

    exports.push({ kind: "class", name: className, methods });
  }

  return exports;
}
