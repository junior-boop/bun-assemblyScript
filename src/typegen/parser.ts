export type ASExportKind = "function" | "const" | "class";

export type ASVisibility = "public" | "protected" | "private";

export interface ASParam {
  readonly name: string;
  readonly type: string;
  readonly optional?: boolean;
  readonly defaultValue?: string;
}

export interface ASExport {
  readonly name: string;
  readonly kind: ASExportKind;
  readonly params?: ASParam[];
  readonly returnType?: string;
  readonly type?: string;
  readonly methods?: ASMethod[];
  readonly fields?: ASField[];
  readonly generics?: string[];   // ex: ["T", "U extends Comparable"]
}

export interface ASMethod extends Omit<ASExport, "kind" | "methods" | "fields"> {
  readonly kind: "function";
  readonly visibility: ASVisibility;
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
}

export interface ASField {
  readonly name: string;
  readonly type: string;
  readonly visibility: ASVisibility;
  readonly isStatic: boolean;
  readonly isReadonly: boolean;
}

// ─── Résultat de parsing avec diagnostics ────────────────────

export interface ASParseWarning {
  kind: "ambiguous_param" | "unterminated_block" | "unknown_type";
  message: string;
  offset?: number;
}

export interface ASParseResult {
  readonly exports: ASExport[];
  readonly warnings: ASParseWarning[];
}

// ─── Utilitaires internes ─────────────────────────────────────

/**
 * Supprime les commentaires // et /* *\/ en préservant les string literals.
 */
function stripComments(source: string): string {
  const chars = [...source];
  let i = 0;

  while (i < chars.length) {
    // Skip string literals
    if (chars[i] === '"' || chars[i] === "'" || chars[i] === "`") {
      const quote = chars[i];
      i++;
      while (i < chars.length && chars[i] !== quote) {
        if (chars[i] === "\\") i++; // skip escaped char
        i++;
      }
      i++;
      continue;
    }

    // Block comment
    if (chars[i] === "/" && chars[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < chars.length - 1 && !(chars[i] === "*" && chars[i + 1] === "/")) {
        chars[i] = " ";
        i++;
      }
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      continue;
    }

    // Line comment
    if (chars[i] === "/" && chars[i + 1] === "/") {
      while (i < chars.length && chars[i] !== "\n") {
        chars[i] = " ";
        i++;
      }
      continue;
    }

    i++;
  }

  return chars.join("");
}

/**
 * Parse les paramètres d'une signature, gère les génériques imbriqués.
 * Ex: "a: i32, b: Map<K, V>, c: f64 = 0.0"
 */
function parseParams(
  paramsStr: string,
  warnings: ASParseWarning[]
): ASParam[] {
  if (!paramsStr.trim()) return [];

  // Séparer par virgule en respectant les <> imbriqués et les strings
  const parts: string[] = [];
  let depth = 0;
  let cursor = 0;

  for (let i = 0; i < paramsStr.length; i++) {
    // Skip string literals
    if (paramsStr[i] === '"' || paramsStr[i] === "'") {
      const quote = paramsStr[i];
      i++;
      while (i < paramsStr.length && paramsStr[i] !== quote) {
        if (paramsStr[i] === "\\") i++;
        i++;
      }
      continue;
    }

    if (paramsStr[i] === "<") depth++;
    else if (paramsStr[i] === ">") depth--;
    else if (paramsStr[i] === "," && depth === 0) {
      parts.push(paramsStr.slice(cursor, i));
      cursor = i + 1;
    }
  }
  parts.push(paramsStr.slice(cursor));

  return parts
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      // "name: Type = default"  ou  "name?: Type"
      const optMatch = /^([a-zA-Z0-9_]+)(\?)?\s*:\s*([\s\S]+?)(?:\s*=\s*([\s\S]+))?$/.exec(raw);
      if (!optMatch) {
        warnings.push({ kind: "ambiguous_param", message: `Unparseable param: "${raw}"` });
        return { name: raw, type: "unknown" };
      }
      return {
        name: optMatch[1],
        optional: optMatch[2] === "?" || undefined,
        type: optMatch[3].trim(),
        defaultValue: optMatch[4]?.trim(),
      };
    });
}

/**
 * Extrait les paramètres génériques d'une déclaration.
 * Ex: "MyClass<T, U extends Comparable>" → ["T", "U extends Comparable"]
 */
function parseGenerics(declaration: string): string[] {
  const m = /<([^>]+)>/.exec(declaration);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Extrait le corps d'un bloc { } en gérant l'imbrication,
 * en ignorant les { } dans les strings et commentaires.
 */
function extractBlock(
  text: string,
  startIndex: number,
  warnings: ASParseWarning[]
): { body: string; end: number } {
  let depth = 0;
  let bodyStart = -1;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    // Skip string literals basique
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === "\\") i++; // escape
        i++;
      }
      continue;
    }

    if (ch === "{") {
      if (depth === 0) bodyStart = i + 1;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && bodyStart !== -1) {
        return { body: text.slice(bodyStart, i), end: i };
      }
    }
  }

  warnings.push({
    kind: "unterminated_block",
    message: `Unterminated block starting at offset ${startIndex}`,
    offset: startIndex,
  });
  return { body: "", end: text.length };
}

/**
 * Parse les champs d'une classe (public/protected/private, static, readonly).
 */
function parseClassFields(body: string, warnings: ASParseWarning[]): ASField[] {
  const fields: ASField[] = [];
  const fieldRegex =
    /(?:(public|protected|private)\s+)?(?:(static)\s+)?(?:(readonly)\s+)?([a-zA-Z0-9_]+)\s*:\s*([^;=\n]+)/g;

  let m: RegExpExecArray | null;
  while ((m = fieldRegex.exec(body)) !== null) {
    // Exclure ce qui ressemble à une méthode (suivi de `(`)
    const after = body.slice(m.index + m[0].length).trimStart();
    if (after.startsWith("(")) continue;

    fields.push({
      visibility: (m[1] as ASVisibility) ?? "public",
      isStatic: m[2] === "static",
      isReadonly: m[3] === "readonly",
      name: m[4],
      type: m[5].trim(),
    });
  }
  return fields;
}

/**
 * Parse les méthodes d'une classe.
 * Exclut les méthodes private/protected si non publiques,
 * gère static et abstract.
 */
function parseClassMethods(body: string, warnings: ASParseWarning[]): ASMethod[] {
  const methods: ASMethod[] = [];

  const methodRegex =
    /(?:(public|protected|private)\s+)?(?:(static)\s+)?(?:(abstract)\s+)?([a-zA-Z0-9_]+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*:\s*([^;{]+)/g;

  let m: RegExpExecArray | null;
  while ((m = methodRegex.exec(body)) !== null) {
    const name = m[4];
    if (name === "constructor") continue;

    const visibility = (m[1] as ASVisibility) ?? "public";
    const generics = m[5] ? parseGenerics(m[5]) : [];
    const params = parseParams(m[6], warnings);
    const returnType = m[7].trim();

    methods.push({
      kind: "function",
      visibility,
      isStatic: m[2] === "static",
      isAbstract: m[3] === "abstract",
      name,
      params,
      returnType,
      generics: generics.length > 0 ? generics : undefined,
    });
  }
  return methods;
}

// ─── Parser principal ─────────────────────────────────────────

/**
 * Parse un fichier source AssemblyScript (.as) et extrait
 * les signatures publiques avec diagnostics.
 */
export function parseASExports(source: string): ASParseResult {
  const text = stripComments(source);
  const exports: ASExport[] = [];
  const warnings: ASParseWarning[] = [];

  // Positions occupées par les blocs de classes (pour exclure les fonctions internes)
  const classRanges: Array<[number, number]> = [];

  // ── 1. Pré-scan des classes pour construire les ranges ──────
  const classPrescan = /export\s+class\s+[a-zA-Z0-9_]+/g;
  let prescanMatch: RegExpExecArray | null;
  while ((prescanMatch = classPrescan.exec(text)) !== null) {
    const { end } = extractBlock(text, prescanMatch.index, warnings);
    classRanges.push([prescanMatch.index, end]);
  }

  const isInsideClass = (offset: number): boolean =>
    classRanges.some(([start, end]) => offset > start && offset < end);

  // ── 2. Fonctions exportées (hors classes) ───────────────────
  const fnRegex =
    /export\s+function\s+([a-zA-Z0-9_]+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*:\s*([^;{]+)/g;

  let match: RegExpExecArray | null;
  while ((match = fnRegex.exec(text)) !== null) {
    if (isInsideClass(match.index)) continue;

    const generics = match[2] ? parseGenerics(match[2]) : [];
    const params = parseParams(match[3], warnings);
    const returnType = match[4].trim();

    exports.push({
      kind: "function",
      name: match[1],
      params,
      returnType,
      generics: generics.length > 0 ? generics : undefined,
    });
  }

  // ── 3. Constantes exportées ──────────────────────────────────
  const constRegex = /export\s+const\s+([a-zA-Z0-9_]+)\s*:\s*([^=;\n]+)/g;
  while ((match = constRegex.exec(text)) !== null) {
    if (isInsideClass(match.index)) continue;
    exports.push({ kind: "const", name: match[1], type: match[2].trim() });
  }

  // ── 4. Classes exportées ─────────────────────────────────────
  const classRegex = /export\s+class\s+([a-zA-Z0-9_]+)\s*(<[^>]*>)?/g;
  while ((match = classRegex.exec(text)) !== null) {
    const className = match[1];
    const generics = match[2] ? parseGenerics(match[2]) : [];
    const { body } = extractBlock(text, match.index, warnings);

    const methods = parseClassMethods(body, warnings);
    const fields = parseClassFields(body, warnings);

    exports.push({
      kind: "class",
      name: className,
      generics: generics.length > 0 ? generics : undefined,
      methods,
      fields,
    });
  }

  return { exports, warnings };
}