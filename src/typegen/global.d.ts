/**
 * ============================================================
 * AssemblyScript Primitive Types — Advanced TypeScript Bindings
 * ============================================================
 * Branded types pour distinguer les primitives AS à la compilation,
 * éviter les mélanges implicites (ex: i32 ≠ f64), et offrir
 * une meilleure expérience IntelliSense dans l'éditeur.
 */

// ─── Branding utility ────────────────────────────────────────
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ─── Integers signés ─────────────────────────────────────────
declare type i8 = Brand<number, "i8">;
declare type i16 = Brand<number, "i16">;
declare type i32 = Brand<number, "i32">;
declare type i64 = Brand<bigint, "i64">;
declare type isize = Brand<number, "isize">;

// ─── Integers non-signés ─────────────────────────────────────
declare type u8 = Brand<number, "u8">;
declare type u16 = Brand<number, "u16">;
declare type u32 = Brand<number, "u32">;
declare type u64 = Brand<bigint, "u64">;
declare type usize = Brand<number, "usize">;

// ─── Flottants ───────────────────────────────────────────────
declare type f32 = Brand<number, "f32">;
declare type f64 = Brand<number, "f64">;

// ─── Booléen ─────────────────────────────────────────────────
declare type bool = Brand<boolean, "bool">;

// ─── SIMD / Références ───────────────────────────────────────
declare type v128 = Brand<never, "v128">;
declare type anyref = Brand<object, "anyref">;
declare type externref = Brand<object, "externref">;

// ─── Helpers de cast (narrowing explicite) ───────────────────
declare function as_i32(v: number): i32;
declare function as_u32(v: number): u32;
declare function as_f64(v: number): f64;
declare function as_i64(v: bigint): i64;
declare function as_u64(v: bigint): u64;
declare function as_bool(v: boolean): bool;

// ─── Groupes utilitaires ─────────────────────────────────────
/** Tout entier AS signé */
type ASSignedInt = i8 | i16 | i32 | i64 | isize;
/** Tout entier AS non-signé */
type ASUnsignedInt = u8 | u16 | u32 | u64 | usize;
/** Tout entier AS */
type ASInteger = ASSignedInt | ASUnsignedInt;
/** Tout flottant AS */
type ASFloat = f32 | f64;
/** Tout numérique AS */
type ASNumeric = ASInteger | ASFloat;
/** Toute primitive AS */
type ASPrimitive = ASNumeric | bool | v128 | anyref | externref;

// ─── Tailles en bits (métadonnée statique) ───────────────────
type BitWidth = 8 | 16 | 32 | 64 | 128;

interface ASTypeInfo<T extends ASPrimitive, W extends BitWidth> {
  readonly type: T;
  readonly bits: W;
  readonly signed: boolean;
  readonly floating: boolean;
}

type ASTypeMap = {
  i8: ASTypeInfo<i8, 8>;
  i16: ASTypeInfo<i16, 16>;
  i32: ASTypeInfo<i32, 32>;
  i64: ASTypeInfo<i64, 64>;
  u8: ASTypeInfo<u8, 8>;
  u16: ASTypeInfo<u16, 16>;
  u32: ASTypeInfo<u32, 32>;
  u64: ASTypeInfo<u64, 64>;
  f32: ASTypeInfo<f32, 32>;
  f64: ASTypeInfo<f64, 64>;
  v128: ASTypeInfo<v128, 128>;
};

// ─── Exports d'un module .as ─────────────────────────────────

/** Fonction exportée depuis un module AssemblyScript */
type ASFunction = (...args: ASPrimitive[]) => ASPrimitive | void;

/** Mémoire linéaire exportée */
interface ASMemory {
  readonly buffer: ArrayBuffer;
  grow(pages: u32): i32;
}

/** Table WebAssembly exportée */
interface ASTable<T extends ASFunction = ASFunction> {
  readonly length: u32;
  get(index: u32): T | null;
}

/** Forme typée des exports d'un module .as */
interface ASModuleExports {
  readonly memory?: ASMemory;
  readonly table?: ASTable;
  [exportName: string]:
    | ASFunction
    | ASMemory
    | ASTable
    | ASPrimitive
    | undefined;
}

declare module "*.as" {
  const exports: ASModuleExports;
  export default exports;
}
