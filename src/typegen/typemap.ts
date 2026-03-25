/**
 * Mappe un type AssemblyScript vers un type de définition TypeScript (.d.ts).
 */
export function mapType(asType: string): string {
  const t = asType.trim();

  // Primitives exactes
  switch (t) {
    case "i8":
    case "i16":
    case "i32":
    case "i64":
    case "u8":
    case "u16":
    case "u32":
    case "u64":
    case "f32":
    case "f64":
    case "isize":
    case "usize":
      return "number";

    case "bool":
      return "boolean";

    case "string":
    case "String":
      return "string";

    case "void":
      return "void";
  }

  // Match des tableaux
  const arrayMatch = t.match(/^(?:Static)?Array<(.+)>$/);
  if (arrayMatch) {
    return `${mapType(arrayMatch[1])}[]`;
  }

  // Match des Maps
  const mapMatch = t.match(/^Map<(.+?)\s*,\s*(.+)>$/);
  if (mapMatch) {
    return `Map<${mapType(mapMatch[1])}, ${mapType(mapMatch[2])}>`;
  }

  // Fallback si type inconnu
  console.warn(
    `[bun-assemblyscript] Warning : Type AssemblyScript non reconnu '${t}'. Fallback sur 'unknown'.`
  );
  return "unknown";
}
