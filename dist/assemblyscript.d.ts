/**
 * ============================================================
 * AssemblyScript Standard Library — TypeScript Bindings
 * ============================================================
 * Typage complet de la stdlib AssemblyScript basé sur la
 * documentation officielle : https://www.assemblyscript.org/stdlib
 *
 * Construit au-dessus du fichier de primitives brandées (assemblyscript.d.ts).
 * Couvre : Globals, Array, ArrayBuffer, console, crypto, DataView,
 * Date, Error, heap, Math/Mathf, Map, Number, process, Set,
 * StaticArray, String, Symbol, TypedArray.
 * ============================================================
 */

// ─── Re-export des primitives brandées ───────────────────────
// (On suppose que assemblyscript.d.ts est inclus dans le projet)
// Les types i8, i16, i32, i64, isize, u8, u16, u32, u64, usize,
// f32, f64, bool, v128, anyref, externref sont déjà déclarés.

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
// ============================================================
// § GLOBALS — Constantes et fonctions du scope global
// ============================================================

/** Not-a-number : f32 ou f64 selon le contexte. */
declare const NaN: f64;
/** Positive infinity : f32 ou f64 selon le contexte. */
declare const Infinity: f64;

/** Teste si une valeur flottante est NaN. */
declare function isNaN<T extends f32 | f64>(value: T): bool;
/** Teste si une valeur flottante est finie (ni NaN ni ±Infinity). */
declare function isFinite<T extends f32 | f64>(value: T): bool;
/** Parse une chaîne représentant un entier en f64. Retourne NaN si invalide. */
declare function parseInt(str: string, radix?: i32): f64;
/** Parse une chaîne en f64. Retourne NaN si invalide. */
declare function parseFloat(str: string): f64;

// ─── Vérifications de type statiques (compilent en constante) ─
declare function isInteger<T>(value?: T): bool;
declare function isSigned<T>(value?: T): bool;
declare function isFloat<T>(value?: T): bool;
declare function isVector<T>(value?: T): bool;
declare function isReference<T>(value?: T): bool;
declare function isString<T>(value?: T): bool;
declare function isArray<T>(value?: T): bool;
declare function isFunction<T>(value?: T): bool;
declare function isNullable<T>(value?: T): bool;
declare function isDefined(expression: unknown): bool;
declare function isConstant(expression: unknown): bool;
declare function isManaged<T>(expression: unknown): bool;

// ─── Utilitaires ──────────────────────────────────────────────
/** Inverse l'ordre des octets d'un entier. */
declare function bswap<T extends ASInteger>(value: T): T;
/** Taille en octets du type de base T. Compile en constante. */
declare function sizeof<T>(): usize;
/** Offset du champ `fieldName` dans la classe T. Compile en constante. */
declare function offsetof<T>(fieldName?: string): usize;
/** Alignement (log2) du type de base T. Compile en constante. */
declare function alignof<T>(): usize;
/** Lève une erreur si `isTrueish` est falsy, sinon retourne la valeur non-nullable. */
declare function assert<T>(isTrueish: T, message?: string): T;
/** Affiche un message et jusqu'à 5 arguments f64 dans la console. */
declare function trace(
  message: string,
  n?: i32,
  a0?: f64,
  a1?: f64,
  a2?: f64,
  a3?: f64,
  a4?: f64,
): void;
/** Instancie un T avec les arguments fournis. */
declare function instantiate<T>(...args: unknown[]): T;
/** Change le type d'une valeur sans conversion. Équivalent d'un cast de pointeur. */
declare function changetype<T>(value: unknown): T;
/** Retourne l'id unique calculé d'un type classe. */
declare function idof<T>(): u32;
/** Retourne le nom du type T. */
declare function nameof<T>(value?: T): string;

// ─── Instructions WebAssembly — Math ─────────────────────────
declare function clz<T extends ASInteger>(value: T): T;
declare function ctz<T extends ASInteger>(value: T): T;
declare function popcnt<T extends ASInteger>(value: T): T;
declare function rotl<T extends i32 | u32 | i64 | u64>(value: T, shift: T): T;
declare function rotr<T extends i32 | u32 | i64 | u64>(value: T, shift: T): T;
declare function abs<T extends ASNumeric>(value: T): T;
declare function max<T extends ASNumeric>(left: T, right: T): T;
declare function min<T extends ASNumeric>(left: T, right: T): T;
declare function ceil<T extends f32 | f64>(value: T): T;
declare function floor<T extends f32 | f64>(value: T): T;
declare function copysign<T extends f32 | f64>(x: T, y: T): T;
declare function nearest<T extends f32 | f64>(value: T): T;
declare function reinterpret<TTo>(value: unknown): TTo;
declare function sqrt<T extends f32 | f64>(value: T): T;
declare function trunc<T extends f32 | f64>(value: T): T;

// ─── Instructions WebAssembly — Mémoire ─────────────────────
declare namespace memory {
  function size(): i32;
  function grow(value: i32): i32;
  function copy(dst: usize, src: usize, n: usize): void;
  function fill(dst: usize, value: u8, n: usize): void;
  function repeat(dst: usize, src: usize, srcLength: usize, count: usize): void;
  function compare(lhs: usize, rhs: usize, n: usize): i32;
  function data(size: i32, align?: i32): usize;
}
declare function load<T>(ptr: usize, immOffset?: usize, immAlign?: usize): T;
declare function store<T>(
  ptr: usize,
  value: unknown,
  immOffset?: usize,
  immAlign?: usize,
): void;

// ─── Instructions WebAssembly — Contrôle ────────────────────
declare function select<T>(ifTrue: T, ifFalse: T, condition: bool): T;
declare function unreachable(): never;

// ─── Atomics 🦄 (--enable threads) ──────────────────────────
/** Résultat d'atomic.wait */
declare const enum AtomicWaitResult {
  OK = 0,
  NOT_EQUAL = 1,
  TIMED_OUT = 2,
}
declare namespace atomic {
  function load<T extends ASInteger>(ptr: usize, immOffset?: usize): T;
  function store<T extends ASInteger>(
    ptr: usize,
    value: T,
    immOffset?: usize,
  ): void;
  function add<T extends ASInteger>(ptr: usize, value: T, immOffset?: usize): T;
  function sub<T extends ASInteger>(ptr: usize, value: T, immOffset?: usize): T;
  function and<T extends ASInteger>(ptr: usize, value: T, immOffset?: usize): T;
  function or<T extends ASInteger>(ptr: usize, value: T, immOffset?: usize): T;
  function xor<T extends ASInteger>(ptr: usize, value: T, immOffset?: usize): T;
  function xchg<T extends ASInteger>(
    ptr: usize,
    value: T,
    immOffset?: usize,
  ): T;
  function cmpxchg<T extends ASInteger>(
    ptr: usize,
    expected: T,
    replacement: T,
    immOffset?: usize,
  ): T;
  function wait<T extends i32 | i64>(
    ptr: usize,
    expected: T,
    timeout: i64,
  ): AtomicWaitResult;
  function notify(ptr: usize, count: i32): i32;
  function fence(): void;
}

// ─── SIMD 🦄 (--enable simd) ─────────────────────────────────
declare function v128(
  a: i8,
  b: i8,
  c: i8,
  d: i8,
  e: i8,
  f: i8,
  g: i8,
  h: i8,
  i: i8,
  j: i8,
  k: i8,
  l: i8,
  m: i8,
  n: i8,
  o: i8,
  p: i8,
): v128;
declare function i8x16(
  a: i8,
  b: i8,
  c: i8,
  d: i8,
  e: i8,
  f: i8,
  g: i8,
  h: i8,
  i: i8,
  j: i8,
  k: i8,
  l: i8,
  m: i8,
  n: i8,
  o: i8,
  p: i8,
): v128;
declare function i16x8(
  a: i16,
  b: i16,
  c: i16,
  d: i16,
  e: i16,
  f: i16,
  g: i16,
  h: i16,
): v128;
declare function i32x4(a: i32, b: i32, c: i32, d: i32): v128;
declare function i64x2(a: i64, b: i64): v128;
declare function f32x4(a: f32, b: f32, c: f32, d: f32): v128;
declare function f64x2(a: f64, b: f64): v128;

declare namespace v128 {
  function splat<T extends ASNumeric>(x: T): v128;
  function extract_lane<T extends ASNumeric>(x: v128, idx: u8): T;
  function replace_lane<T extends ASNumeric>(x: v128, idx: u8, value: T): v128;
  function shuffle<T extends ASNumeric>(a: v128, b: v128, ...lanes: u8[]): v128;
  function swizzle(a: v128, s: v128): v128;
  function load(ptr: usize, immOffset?: usize, immAlign?: usize): v128;
  function load_ext<TFrom extends ASInteger>(
    ptr: usize,
    immOffset?: usize,
    immAlign?: usize,
  ): v128;
  function load_zero<TFrom extends i32 | u32 | f32 | i64 | u64 | f64>(
    ptr: usize,
    immOffset?: usize,
    immAlign?: usize,
  ): v128;
  function load_lane<T extends ASNumeric>(
    ptr: usize,
    vec: v128,
    idx: u8,
    immOffset?: usize,
    immAlign?: usize,
  ): v128;
  function store_lane<T extends ASNumeric>(
    ptr: usize,
    vec: v128,
    idx: u8,
    immOffset?: usize,
    immAlign?: usize,
  ): v128;
  function load_splat<T extends ASNumeric>(
    ptr: usize,
    immOffset?: usize,
    immAlign?: usize,
  ): v128;
  function store(
    ptr: usize,
    value: v128,
    immOffset?: usize,
    immAlign?: usize,
  ): void;
  function add<T extends ASNumeric>(a: v128, b: v128): v128;
  function sub<T extends ASNumeric>(a: v128, b: v128): v128;
  function mul<T extends ASNumeric>(a: v128, b: v128): v128;
  function div<T extends f32 | f64>(a: v128, b: v128): v128;
  function neg<T extends ASNumeric>(a: v128): v128;
  function add_sat<T extends i8 | u8 | i16 | u16>(a: v128, b: v128): v128;
  function sub_sat<T extends i8 | u8 | i16 | u16>(a: v128, b: v128): v128;
  function shl<T extends ASInteger>(a: v128, b: i32): v128;
  function shr<T extends ASInteger>(a: v128, b: i32): v128;
  function and(a: v128, b: v128): v128;
  function or(a: v128, b: v128): v128;
  function xor(a: v128, b: v128): v128;
  function andnot(a: v128, b: v128): v128;
  function not(a: v128): v128;
  function bitselect(v1: v128, v2: v128, mask: v128): v128;
  function any_true(a: v128): bool;
  function all_true<T extends ASInteger>(a: v128): bool;
  function bitmask<T extends ASInteger>(a: v128): bool;
  function popcnt<T extends i8 | u8>(a: v128): v128;
  function min<T extends ASNumeric>(a: v128, b: v128): v128;
  function max<T extends ASNumeric>(a: v128, b: v128): v128;
  function pmin<T extends f32 | f64>(a: v128, b: v128): v128;
  function pmax<T extends f32 | f64>(a: v128, b: v128): v128;
  function dot<T extends i16>(a: v128, b: v128): v128;
  function avgr<T extends u8 | u16>(a: v128, b: v128): v128;
  function abs<T extends ASNumeric>(a: v128): v128;
  function sqrt<T extends f32 | f64>(a: v128): v128;
  function ceil<T extends f32 | f64>(a: v128): v128;
  function floor<T extends f32 | f64>(a: v128): v128;
  function trunc<T extends f32 | f64>(a: v128): v128;
  function nearest<T extends f32 | f64>(a: v128): v128;
  function eq<T extends ASNumeric>(a: v128, b: v128): v128;
  function ne<T extends ASNumeric>(a: v128, b: v128): v128;
  function lt<T extends ASNumeric>(a: v128, b: v128): v128;
  function le<T extends ASNumeric>(a: v128, b: v128): v128;
  function gt<T extends ASNumeric>(a: v128, b: v128): v128;
  function ge<T extends ASNumeric>(a: v128, b: v128): v128;
  function convert<TFrom extends i32 | u32>(a: v128): v128;
  function convert_low<TFrom extends i32 | u32>(a: v128): v128;
  function trunc_sat<TTo extends i32 | u32>(a: v128): v128;
  function trunc_sat_zero<TTo extends i32 | u32>(a: v128): v128;
  function narrow<TFrom extends i16 | u16 | i32 | u32>(a: v128, b: v128): v128;
  function extend_low<TFrom extends i8 | u8 | i16 | u16 | i32 | u32>(
    a: v128,
  ): v128;
  function extend_high<TFrom extends i8 | u8 | i16 | u16 | i32 | u32>(
    a: v128,
  ): v128;
  function extadd_pairwise<TFrom extends i16 | u16 | i32 | u32>(a: v128): v128;
  function demote_zero<T extends f64>(a: v128): v128;
  function promote_low<T extends f32>(a: v128): v128;
  function q15mulr_sat<T extends i16>(a: v128, b: v128): v128;
  function extmul_low<T extends i8 | u8 | i16 | u16 | i32 | u32>(
    a: v128,
    b: v128,
  ): v128;
  function extmul_high<T extends i8 | u8 | i16 | u16 | i32 | u32>(
    a: v128,
    b: v128,
  ): v128;
  // Relaxed SIMD (--enable relaxed-simd)
  function relaxed_swizzle(a: v128, s: v128): v128;
  function relaxed_trunc<T extends i32 | u32>(a: v128): v128;
  function relaxed_trunc_zero<T extends i32 | u32>(a: v128): v128;
  function relaxed_madd<T extends f32 | f64>(a: v128, b: v128, c: v128): v128;
  function relaxed_nmadd<T extends f32 | f64>(a: v128, b: v128, c: v128): v128;
  function relaxed_laneselect<T extends ASInteger>(
    a: v128,
    b: v128,
    m: v128,
  ): v128;
  function relaxed_min<T extends f32 | f64>(a: v128, b: v128): v128;
  function relaxed_max<T extends f32 | f64>(a: v128, b: v128): v128;
  function relaxed_q15mulr<T extends i16>(a: v128, b: v128): v128;
  function relaxed_dot<T extends i16>(a: v128, b: v128): v128;
  function relaxed_dot_add<T extends i32>(a: v128, b: v128, c: v128): v128;
}

// ============================================================
// § ARRAY
// ============================================================

declare class Array<T> {
  /** Longueur du tableau. L'agrandir provoque un resize automatique. */
  length: i32;
  constructor(capacity?: i32);

  static isArray<U>(value: U): bool;

  concat(other: Array<T>): Array<T>;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: T, index: i32, self: Array<T>) => bool): bool;
  fill(value: T, start?: i32, end?: i32): this;
  filter(fn: (value: T, index: i32, self: Array<T>) => bool): Array<T>;
  findIndex(fn: (value: T, index: i32, self: Array<T>) => bool): i32;
  findLastIndex(fn: (value: T, index: i32, self: Array<T>) => bool): i32;
  flat(): Array<T extends Array<infer U> ? U : T>;
  forEach(fn: (value: T, index: i32, self: Array<T>) => void): void;
  includes(value: T, fromIndex?: i32): bool;
  indexOf(value: T, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: T, fromIndex?: i32): i32;
  map<U>(fn: (value: T, index: i32, self: Array<T>) => U): Array<U>;
  pop(): T;
  push(value: T): i32;
  reduce<U>(
    fn: (accumValue: U, currentValue: T, index: i32, self: Array<T>) => U,
    initialValue: U,
  ): U;
  reduceRight<U>(
    fn: (accumValue: U, currentValue: T, index: i32, self: Array<T>) => U,
    initialValue: U,
  ): U;
  reverse(): this;
  shift(): T;
  slice(start?: i32, end?: i32): Array<T>;
  some(fn: (value: T, index: i32, self: Array<T>) => bool): bool;
  sort(fn?: (a: T, b: T) => i32): this;
  splice(start: i32, deleteCount?: i32): Array<T>;
  toString(): string;
  unshift(value: T): i32;
}

// ============================================================
// § ARRAYBUFFER
// ============================================================

declare class ArrayBuffer {
  /** Taille du buffer en octets. */
  readonly byteLength: i32;
  constructor(byteLength: i32);

  static isView<T>(value: T): bool;
  slice(begin?: i32, end?: i32): ArrayBuffer;
  toString(): string;
}

// ============================================================
// § STATICARRAY
// ============================================================

/** Tableau de taille fixe alloué en mémoire linéaire. */
declare class StaticArray<T> {
  readonly length: i32;
  constructor(length: i32);

  static fromArray<T>(source: Array<T>): StaticArray<T>;
  static slice<T>(
    source: StaticArray<T>,
    start?: i32,
    end?: i32,
  ): StaticArray<T>;
  static concat<T>(
    source: StaticArray<T>,
    other: StaticArray<T>,
  ): StaticArray<T>;

  concat(other: StaticArray<T>): StaticArray<T>;
  includes(value: T, fromIndex?: i32): bool;
  indexOf(value: T, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: T, fromIndex?: i32): i32;
  slice(start?: i32, end?: i32): StaticArray<T>;
  toString(): string;
}

// ============================================================
// § TYPEDARRAY
// ============================================================

/** Interface commune à tous les typed arrays. */
interface TypedArray<T extends ASNumeric> {
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;

  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: T, index: i32, self: this) => bool): bool;
  fill(value: T, start?: i32, end?: i32): this;
  filter(fn: (value: T, index: i32, self: this) => bool): this;
  findIndex(fn: (value: T, index: i32, self: this) => bool): i32;
  forEach(fn: (value: T, index: i32, self: this) => void): void;
  includes(value: T, fromIndex?: i32): bool;
  indexOf(value: T, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: T, fromIndex?: i32): i32;
  map(fn: (value: T, index: i32, self: this) => T): this;
  reduce<U>(
    fn: (accumValue: U, currentValue: T, index: i32, self: this) => U,
    initialValue: U,
  ): U;
  reduceRight<U>(
    fn: (accumValue: U, currentValue: T, index: i32, self: this) => U,
    initialValue: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<number>, offset?: i32): void;
  slice(start?: i32, end?: i32): this;
  some(fn: (value: T, index: i32, self: this) => bool): bool;
  sort(fn?: (a: T, b: T) => i32): this;
  subarray(start?: i32, end?: i32): this;
  toString(): string;
}

declare class Int8Array implements TypedArray<i8> {
  constructor(length: i32);
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: i8, index: i32, self: Int8Array) => bool): bool;
  fill(value: i8, start?: i32, end?: i32): this;
  filter(fn: (value: i8, index: i32, self: Int8Array) => bool): Int8Array;
  findIndex(fn: (value: i8, index: i32, self: Int8Array) => bool): i32;
  forEach(fn: (value: i8, index: i32, self: Int8Array) => void): void;
  includes(value: i8, fromIndex?: i32): bool;
  indexOf(value: i8, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: i8, fromIndex?: i32): i32;
  map(fn: (value: i8, index: i32, self: Int8Array) => i8): Int8Array;
  reduce<U>(fn: (acc: U, cur: i8, idx: i32, self: Int8Array) => U, init: U): U;
  reduceRight<U>(
    fn: (acc: U, cur: i8, idx: i32, self: Int8Array) => U,
    init: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<number>, offset?: i32): void;
  slice(start?: i32, end?: i32): Int8Array;
  some(fn: (value: i8, index: i32, self: Int8Array) => bool): bool;
  sort(fn?: (a: i8, b: i8) => i32): this;
  subarray(start?: i32, end?: i32): Int8Array;
  toString(): string;
}
declare class Uint8Array implements TypedArray<u8> {
  constructor(length: i32);
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: u8, index: i32, self: Uint8Array) => bool): bool;
  fill(value: u8, start?: i32, end?: i32): this;
  filter(fn: (value: u8, index: i32, self: Uint8Array) => bool): Uint8Array;
  findIndex(fn: (value: u8, index: i32, self: Uint8Array) => bool): i32;
  forEach(fn: (value: u8, index: i32, self: Uint8Array) => void): void;
  includes(value: u8, fromIndex?: i32): bool;
  indexOf(value: u8, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: u8, fromIndex?: i32): i32;
  map(fn: (value: u8, index: i32, self: Uint8Array) => u8): Uint8Array;
  reduce<U>(fn: (acc: U, cur: u8, idx: i32, self: Uint8Array) => U, init: U): U;
  reduceRight<U>(
    fn: (acc: U, cur: u8, idx: i32, self: Uint8Array) => U,
    init: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<number>, offset?: i32): void;
  slice(start?: i32, end?: i32): Uint8Array;
  some(fn: (value: u8, index: i32, self: Uint8Array) => bool): bool;
  sort(fn?: (a: u8, b: u8) => i32): this;
  subarray(start?: i32, end?: i32): Uint8Array;
  toString(): string;
}
declare class Uint8ClampedArray implements TypedArray<u8> {
  constructor(length: i32);
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: u8, index: i32, self: Uint8ClampedArray) => bool): bool;
  fill(value: u8, start?: i32, end?: i32): this;
  filter(
    fn: (value: u8, index: i32, self: Uint8ClampedArray) => bool,
  ): Uint8ClampedArray;
  findIndex(fn: (value: u8, index: i32, self: Uint8ClampedArray) => bool): i32;
  forEach(fn: (value: u8, index: i32, self: Uint8ClampedArray) => void): void;
  includes(value: u8, fromIndex?: i32): bool;
  indexOf(value: u8, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: u8, fromIndex?: i32): i32;
  map(
    fn: (value: u8, index: i32, self: Uint8ClampedArray) => u8,
  ): Uint8ClampedArray;
  reduce<U>(
    fn: (acc: U, cur: u8, idx: i32, self: Uint8ClampedArray) => U,
    init: U,
  ): U;
  reduceRight<U>(
    fn: (acc: U, cur: u8, idx: i32, self: Uint8ClampedArray) => U,
    init: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<number>, offset?: i32): void;
  slice(start?: i32, end?: i32): Uint8ClampedArray;
  some(fn: (value: u8, index: i32, self: Uint8ClampedArray) => bool): bool;
  sort(fn?: (a: u8, b: u8) => i32): this;
  subarray(start?: i32, end?: i32): Uint8ClampedArray;
  toString(): string;
}
declare class Int16Array implements TypedArray<i16> {
  constructor(length: i32);
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: i16, index: i32, self: Int16Array) => bool): bool;
  fill(value: i16, start?: i32, end?: i32): this;
  filter(fn: (value: i16, index: i32, self: Int16Array) => bool): Int16Array;
  findIndex(fn: (value: i16, index: i32, self: Int16Array) => bool): i32;
  forEach(fn: (value: i16, index: i32, self: Int16Array) => void): void;
  includes(value: i16, fromIndex?: i32): bool;
  indexOf(value: i16, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: i16, fromIndex?: i32): i32;
  map(fn: (value: i16, index: i32, self: Int16Array) => i16): Int16Array;
  reduce<U>(
    fn: (acc: U, cur: i16, idx: i32, self: Int16Array) => U,
    init: U,
  ): U;
  reduceRight<U>(
    fn: (acc: U, cur: i16, idx: i32, self: Int16Array) => U,
    init: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<number>, offset?: i32): void;
  slice(start?: i32, end?: i32): Int16Array;
  some(fn: (value: i16, index: i32, self: Int16Array) => bool): bool;
  sort(fn?: (a: i16, b: i16) => i32): this;
  subarray(start?: i32, end?: i32): Int16Array;
  toString(): string;
}
declare class Uint16Array implements TypedArray<u16> {
  constructor(length: i32);
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: u16, index: i32, self: Uint16Array) => bool): bool;
  fill(value: u16, start?: i32, end?: i32): this;
  filter(fn: (value: u16, index: i32, self: Uint16Array) => bool): Uint16Array;
  findIndex(fn: (value: u16, index: i32, self: Uint16Array) => bool): i32;
  forEach(fn: (value: u16, index: i32, self: Uint16Array) => void): void;
  includes(value: u16, fromIndex?: i32): bool;
  indexOf(value: u16, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: u16, fromIndex?: i32): i32;
  map(fn: (value: u16, index: i32, self: Uint16Array) => u16): Uint16Array;
  reduce<U>(
    fn: (acc: U, cur: u16, idx: i32, self: Uint16Array) => U,
    init: U,
  ): U;
  reduceRight<U>(
    fn: (acc: U, cur: u16, idx: i32, self: Uint16Array) => U,
    init: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<number>, offset?: i32): void;
  slice(start?: i32, end?: i32): Uint16Array;
  some(fn: (value: u16, index: i32, self: Uint16Array) => bool): bool;
  sort(fn?: (a: u16, b: u16) => i32): this;
  subarray(start?: i32, end?: i32): Uint16Array;
  toString(): string;
}
declare class Int32Array implements TypedArray<i32> {
  constructor(length: i32);
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: i32, index: i32, self: Int32Array) => bool): bool;
  fill(value: i32, start?: i32, end?: i32): this;
  filter(fn: (value: i32, index: i32, self: Int32Array) => bool): Int32Array;
  findIndex(fn: (value: i32, index: i32, self: Int32Array) => bool): i32;
  forEach(fn: (value: i32, index: i32, self: Int32Array) => void): void;
  includes(value: i32, fromIndex?: i32): bool;
  indexOf(value: i32, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: i32, fromIndex?: i32): i32;
  map(fn: (value: i32, index: i32, self: Int32Array) => i32): Int32Array;
  reduce<U>(
    fn: (acc: U, cur: i32, idx: i32, self: Int32Array) => U,
    init: U,
  ): U;
  reduceRight<U>(
    fn: (acc: U, cur: i32, idx: i32, self: Int32Array) => U,
    init: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<number>, offset?: i32): void;
  slice(start?: i32, end?: i32): Int32Array;
  some(fn: (value: i32, index: i32, self: Int32Array) => bool): bool;
  sort(fn?: (a: i32, b: i32) => i32): this;
  subarray(start?: i32, end?: i32): Int32Array;
  toString(): string;
}
declare class Uint32Array implements TypedArray<u32> {
  constructor(length: i32);
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: u32, index: i32, self: Uint32Array) => bool): bool;
  fill(value: u32, start?: i32, end?: i32): this;
  filter(fn: (value: u32, index: i32, self: Uint32Array) => bool): Uint32Array;
  findIndex(fn: (value: u32, index: i32, self: Uint32Array) => bool): i32;
  forEach(fn: (value: u32, index: i32, self: Uint32Array) => void): void;
  includes(value: u32, fromIndex?: i32): bool;
  indexOf(value: u32, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: u32, fromIndex?: i32): i32;
  map(fn: (value: u32, index: i32, self: Uint32Array) => u32): Uint32Array;
  reduce<U>(
    fn: (acc: U, cur: u32, idx: i32, self: Uint32Array) => U,
    init: U,
  ): U;
  reduceRight<U>(
    fn: (acc: U, cur: u32, idx: i32, self: Uint32Array) => U,
    init: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<number>, offset?: i32): void;
  slice(start?: i32, end?: i32): Uint32Array;
  some(fn: (value: u32, index: i32, self: Uint32Array) => bool): bool;
  sort(fn?: (a: u32, b: u32) => i32): this;
  subarray(start?: i32, end?: i32): Uint32Array;
  toString(): string;
}
declare class Int64Array implements TypedArray<i64> {
  constructor(length: i32);
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: i64, index: i32, self: Int64Array) => bool): bool;
  fill(value: i64, start?: i32, end?: i32): this;
  filter(fn: (value: i64, index: i32, self: Int64Array) => bool): Int64Array;
  findIndex(fn: (value: i64, index: i32, self: Int64Array) => bool): i32;
  forEach(fn: (value: i64, index: i32, self: Int64Array) => void): void;
  includes(value: i64, fromIndex?: i32): bool;
  indexOf(value: i64, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: i64, fromIndex?: i32): i32;
  map(fn: (value: i64, index: i32, self: Int64Array) => i64): Int64Array;
  reduce<U>(
    fn: (acc: U, cur: i64, idx: i32, self: Int64Array) => U,
    init: U,
  ): U;
  reduceRight<U>(
    fn: (acc: U, cur: i64, idx: i32, self: Int64Array) => U,
    init: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<bigint>, offset?: i32): void;
  slice(start?: i32, end?: i32): Int64Array;
  some(fn: (value: i64, index: i32, self: Int64Array) => bool): bool;
  sort(fn?: (a: i64, b: i64) => i32): this;
  subarray(start?: i32, end?: i32): Int64Array;
  toString(): string;
}
declare class Uint64Array implements TypedArray<u64> {
  constructor(length: i32);
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: u64, index: i32, self: Uint64Array) => bool): bool;
  fill(value: u64, start?: i32, end?: i32): this;
  filter(fn: (value: u64, index: i32, self: Uint64Array) => bool): Uint64Array;
  findIndex(fn: (value: u64, index: i32, self: Uint64Array) => bool): i32;
  forEach(fn: (value: u64, index: i32, self: Uint64Array) => void): void;
  includes(value: u64, fromIndex?: i32): bool;
  indexOf(value: u64, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: u64, fromIndex?: i32): i32;
  map(fn: (value: u64, index: i32, self: Uint64Array) => u64): Uint64Array;
  reduce<U>(
    fn: (acc: U, cur: u64, idx: i32, self: Uint64Array) => U,
    init: U,
  ): U;
  reduceRight<U>(
    fn: (acc: U, cur: u64, idx: i32, self: Uint64Array) => U,
    init: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<bigint>, offset?: i32): void;
  slice(start?: i32, end?: i32): Uint64Array;
  some(fn: (value: u64, index: i32, self: Uint64Array) => bool): bool;
  sort(fn?: (a: u64, b: u64) => i32): this;
  subarray(start?: i32, end?: i32): Uint64Array;
  toString(): string;
}
declare class Float32Array implements TypedArray<f32> {
  constructor(length: i32);
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: f32, index: i32, self: Float32Array) => bool): bool;
  fill(value: f32, start?: i32, end?: i32): this;
  filter(
    fn: (value: f32, index: i32, self: Float32Array) => bool,
  ): Float32Array;
  findIndex(fn: (value: f32, index: i32, self: Float32Array) => bool): i32;
  forEach(fn: (value: f32, index: i32, self: Float32Array) => void): void;
  includes(value: f32, fromIndex?: i32): bool;
  indexOf(value: f32, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: f32, fromIndex?: i32): i32;
  map(fn: (value: f32, index: i32, self: Float32Array) => f32): Float32Array;
  reduce<U>(
    fn: (acc: U, cur: f32, idx: i32, self: Float32Array) => U,
    init: U,
  ): U;
  reduceRight<U>(
    fn: (acc: U, cur: f32, idx: i32, self: Float32Array) => U,
    init: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<number>, offset?: i32): void;
  slice(start?: i32, end?: i32): Float32Array;
  some(fn: (value: f32, index: i32, self: Float32Array) => bool): bool;
  sort(fn?: (a: f32, b: f32) => i32): this;
  subarray(start?: i32, end?: i32): Float32Array;
  toString(): string;
}
declare class Float64Array implements TypedArray<f64> {
  constructor(length: i32);
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  readonly length: i32;
  copyWithin(target: i32, start: i32, end?: i32): this;
  every(fn: (value: f64, index: i32, self: Float64Array) => bool): bool;
  fill(value: f64, start?: i32, end?: i32): this;
  filter(
    fn: (value: f64, index: i32, self: Float64Array) => bool,
  ): Float64Array;
  findIndex(fn: (value: f64, index: i32, self: Float64Array) => bool): i32;
  forEach(fn: (value: f64, index: i32, self: Float64Array) => void): void;
  includes(value: f64, fromIndex?: i32): bool;
  indexOf(value: f64, fromIndex?: i32): i32;
  join(separator?: string): string;
  lastIndexOf(value: f64, fromIndex?: i32): i32;
  map(fn: (value: f64, index: i32, self: Float64Array) => f64): Float64Array;
  reduce<U>(
    fn: (acc: U, cur: f64, idx: i32, self: Float64Array) => U,
    init: U,
  ): U;
  reduceRight<U>(
    fn: (acc: U, cur: f64, idx: i32, self: Float64Array) => U,
    init: U,
  ): U;
  reverse(): this;
  set(array: ArrayLike<number>, offset?: i32): void;
  slice(start?: i32, end?: i32): Float64Array;
  some(fn: (value: f64, index: i32, self: Float64Array) => bool): bool;
  sort(fn?: (a: f64, b: f64) => i32): this;
  subarray(start?: i32, end?: i32): Float64Array;
  toString(): string;
}

// ============================================================
// § DATAVIEW
// ============================================================

declare class DataView {
  readonly buffer: ArrayBuffer;
  readonly byteLength: i32;
  readonly byteOffset: i32;
  constructor(buffer: ArrayBuffer, byteOffset?: i32, byteLength?: i32);

  getFloat32(byteOffset: i32, littleEndian?: bool): f32;
  getFloat64(byteOffset: i32, littleEndian?: bool): f64;
  getInt8(byteOffset: i32): i8;
  getInt16(byteOffset: i32, littleEndian?: bool): i16;
  getInt32(byteOffset: i32, littleEndian?: bool): i32;
  getInt64(byteOffset: i32, littleEndian?: bool): i64;
  getUint8(byteOffset: i32): u8;
  getUint16(byteOffset: i32, littleEndian?: bool): u16;
  getUint32(byteOffset: i32, littleEndian?: bool): u32;
  getUint64(byteOffset: i32, littleEndian?: bool): u64;
  setFloat32(byteOffset: i32, value: f32, littleEndian?: bool): void;
  setFloat64(byteOffset: i32, value: f64, littleEndian?: bool): void;
  setInt8(byteOffset: i32, value: i8): void;
  setInt16(byteOffset: i32, value: i16, littleEndian?: bool): void;
  setInt32(byteOffset: i32, value: i32, littleEndian?: bool): void;
  setInt64(byteOffset: i32, value: i64, littleEndian?: bool): void;
  setUint8(byteOffset: i32, value: u8): void;
  setUint16(byteOffset: i32, value: u16, littleEndian?: bool): void;
  setUint32(byteOffset: i32, value: u32, littleEndian?: bool): void;
  setUint64(byteOffset: i32, value: u64, littleEndian?: bool): void;
  toString(): string;
}

// ============================================================
// § STRING
// ============================================================

declare class String {
  readonly length: i32;

  static fromCharCode(unit: i32, surr?: i32): string;
  static fromCharCodes(units: u16[]): string;
  static fromCodePoint(code: i32): string;
  static fromCodePoints(codes: i32[]): string;

  at(pos: i32): string;
  charAt(pos: i32): string;
  charCodeAt(pos: i32): i32;
  codePointAt(pos: i32): i32;
  concat(other: string): string;
  endsWith(search: string, end?: i32): bool;
  includes(search: string, start?: i32): bool;
  indexOf(search: string, start?: i32): i32;
  lastIndexOf(search: string, start?: i32): i32;
  padStart(length: i32, pad: string): string;
  padEnd(length: i32, pad: string): string;
  repeat(count?: i32): string;
  replace(search: string, replacement: string): string;
  replaceAll(search: string, replacement: string): string;
  slice(start: i32, end?: i32): string;
  split(separator?: string, limit?: i32): string[];
  startsWith(search: string, start?: i32): bool;
  substring(start: i32, end?: i32): string;
  toString(): this;
  trim(): string;
  trimStart(): string;
  trimLeft(): string;
  trimEnd(): string;
  trimRight(): string;

  // Encoding API — UTF-8
  static readonly UTF8: {
    byteLength(str: string, nullTerminated?: bool): i32;
    encode(str: string, nullTerminated?: bool): ArrayBuffer;
    encodeUnsafe(
      str: usize,
      len: i32,
      buf: usize,
      nullTerminated?: bool,
    ): usize;
    decode(buf: ArrayBuffer, nullTerminated?: bool): string;
    decodeUnsafe(buf: usize, len: usize, nullTerminated?: bool): string;
  };

  // Encoding API — UTF-16
  static readonly UTF16: {
    byteLength(str: string): i32;
    encode(str: string): ArrayBuffer;
    encodeUnsafe(str: usize, len: i32, buf: usize): usize;
    decode(buf: ArrayBuffer): string;
    decodeUnsafe(buf: usize, len: usize): string;
  };
}
/** `string` est un alias de `String` en AssemblyScript. */
declare type string = String;

// ============================================================
// § MAP
// ============================================================

declare class Map<K, V> {
  readonly size: i32;
  constructor();

  clear(): void;
  delete(key: K): bool;
  /**
   * Retourne la valeur pour la clé donnée.
   * ⚠️ Lève une erreur si la clé n'existe pas — utiliser `has()` avant.
   */
  get(key: K): V;
  has(key: K): bool;
  keys(): Array<K>;
  set(key: K, value: V): this;
  values(): Array<V>;
  toString(): string;
}

// ============================================================
// § SET
// ============================================================

declare class Set<T> {
  readonly size: i32;
  constructor();

  add(value: T): void;
  delete(value: T): bool;
  clear(): void;
  has(value: T): bool;
  values(): Array<T>;
  toString(): string;
}

// ============================================================
// § MATH / MATHF
// ============================================================

/** Interface commune aux variantes Math (f64) et Mathf (f32). */
interface MathNamespace<T extends f32 | f64> {
  readonly E: T;
  readonly LN2: T;
  readonly LN10: T;
  readonly LOG2E: T;
  readonly LOG10E: T;
  readonly PI: T;
  readonly SQRT1_2: T;
  readonly SQRT2: T;

  abs(x: T): T;
  acos(x: T): T;
  acosh(x: T): T;
  asin(x: T): T;
  asinh(x: T): T;
  atan(x: T): T;
  atan2(y: T, x: T): T;
  atanh(x: T): T;
  cbrt(x: T): T;
  ceil(x: T): T;
  clz32(x: T): T;
  cos(x: T): T;
  cosh(x: T): T;
  exp(x: T): T;
  expm1(x: T): T;
  floor(x: T): T;
  fround(x: T): T;
  hypot(value1: T, value2: T): T;
  imul(a: T, b: T): T;
  log(x: T): T;
  log10(x: T): T;
  log1p(x: T): T;
  log2(x: T): T;
  max(value1: T, value2: T): T;
  min(value1: T, value2: T): T;
  pow(base: T, exponent: T): T;
  random(): T;
  round(x: T): T;
  seedRandom(value: i64): void;
  sign(x: T): T;
  signbit(x: T): bool;
  sin(x: T): T;
  sinh(x: T): T;
  sqrt(x: T): T;
  tan(x: T): T;
  tanh(x: T): T;
  trunc(x: T): T;
}

/** NativeMath — implémentation WASM pour f64 (alias global `Math`). */
declare const NativeMath: MathNamespace<f64>;
/** NativeMathf — implémentation WASM pour f32 (alias global `Mathf`). */
declare const NativeMathf: MathNamespace<f32>;
/** JSMath — délégation à l'implémentation hôte JS pour f64 (--use Math=JSMath). */
declare const JSMath: MathNamespace<f64>;

/** Alias global vers NativeMath (f64). */
declare const Math: MathNamespace<f64>;
/** Alias global vers NativeMathf (f32). */
declare const Mathf: MathNamespace<f32>;

// ============================================================
// § NUMBER — Wrappers numériques par type
// ============================================================

/** Classe wrapper et namespace de parse/format pour un type numérique T. */
interface NumberNamespace<T extends ASNumeric> {
  readonly MIN_VALUE: T;
  readonly MAX_VALUE: T;
  readonly MIN_SAFE_INTEGER?: T;
  readonly MAX_SAFE_INTEGER?: T;
  readonly EPSILON?: T;
  parseInt(value: string, radix?: i32): T;
  parseFloat?(value: string): T;
  isNaN?(value: T): bool;
  isFinite?(value: T): bool;
  isSafeInteger?(value: T): bool;
  isInteger?(value: T): bool;
  toString(radix?: i32): string;
  toFixed(fractionDigits?: i32): string;
  toExponential(fractionDigits?: i32): string;
  toPrecision(precision?: i32): string;
}

declare const I8: NumberNamespace<i8>;
declare const I16: NumberNamespace<i16>;
declare const I32: NumberNamespace<i32>;
declare const I64: NumberNamespace<i64>;
declare const U8: NumberNamespace<u8>;
declare const U16: NumberNamespace<u16>;
declare const U32: NumberNamespace<u32>;
declare const U64: NumberNamespace<u64>;
declare const F32: NumberNamespace<f32>;
declare const F64: NumberNamespace<f64>;

// ============================================================
// § DATE
// ============================================================

declare class Date {
  constructor(value: i64);

  static now(): i64;
  static UTC(
    year: i32,
    month?: i32,
    day?: i32,
    hour?: i32,
    minute?: i32,
    second?: i32,
    ms?: i32,
  ): i64;

  getTime(): i64;
  setTime(value: i64): i64;
  getFullYear(): i32;
  setFullYear(value: i32): void;
  getMonth(): i32;
  setMonth(value: i32): void;
  getDate(): i32;
  setDate(value: i32): void;
  getDay(): i32;
  getHours(): i32;
  setHours(value: i32): void;
  getMinutes(): i32;
  setMinutes(value: i32): void;
  getSeconds(): i32;
  setSeconds(value: i32): void;
  getMilliseconds(): i32;
  setMilliseconds(value: i32): void;
  getUTCFullYear(): i32;
  getUTCMonth(): i32;
  getUTCDate(): i32;
  getUTCDay(): i32;
  getUTCHours(): i32;
  getUTCMinutes(): i32;
  getUTCSeconds(): i32;
  getUTCMilliseconds(): i32;
  toISOString(): string;
  toUTCString(): string;
  toString(): string;
  valueOf(): i64;
}

// ============================================================
// § ERROR
// ============================================================

declare class Error {
  name: string;
  message: string;
  stack: string | null;
  constructor(message?: string);
  toString(): string;
}

declare class RangeError extends Error {
  constructor(message?: string);
}
declare class TypeError extends Error {
  constructor(message?: string);
}
declare class SyntaxError extends Error {
  constructor(message?: string);
}
declare class URIError extends Error {
  constructor(message?: string);
}
declare class EvalError extends Error {
  constructor(message?: string);
}
declare class ReferenceError extends Error {
  constructor(message?: string);
}

// ============================================================
// § HEAP — Gestion mémoire manuelle
// ============================================================

declare namespace heap {
  /** Alloue un bloc d'au moins `size` octets. */
  function alloc(size: usize): usize;
  /** Réalloue un bloc pour avoir au moins `size` octets. */
  function realloc(ptr: usize, size: usize): usize;
  /** Libère un bloc. */
  function free(ptr: usize): void;
  /** ⚠️ Réinitialise tout le heap (stub runtime uniquement). */
  function reset(): void;
}

// ============================================================
// § CONSOLE
// ============================================================

declare namespace console {
  function assert<T>(assertion: T, message?: string): void;
  function log(message?: string): void;
  function debug(message?: string): void;
  function info(message?: string): void;
  function warn(message?: string): void;
  function error(message?: string): void;
  function time(label?: string): void;
  function timeLog(label?: string): void;
  function timeEnd(label?: string): void;
  function count(label?: string): void;
  function countReset(label?: string): void;
  function clear(): void;
}

// ============================================================
// § CRYPTO
// ============================================================

declare namespace crypto {
  /** Remplit le buffer fourni avec des valeurs aléatoires sécurisées. */
  function getRandomValues<T extends ArrayBufferView>(array: T): T;
}

// ============================================================
// § PROCESS
// ============================================================

declare interface ReadableStream {
  read(n?: i32): string | null;
}

declare interface WritableStream {
  write(s: string): void;
}

declare namespace process {
  /** Architecture CPU : "wasm32" ou "wasm64". */
  const arch: string;
  /** Plateforme : toujours "wasm". */
  const platform: string;
  /** Arguments passés au binaire à l'instantiation. */
  const argv: string[];
  /** Variables d'environnement. */
  const env: Map<string, string>;
  /** Code de sortie du processus. Défaut : 0. */
  var exitCode: i32;
  /** Termine le processus avec le code fourni ou `process.exitCode`. */
  function exit(code?: i32): never;
  const stdin: ReadableStream;
  const stdout: WritableStream;
  const stderr: WritableStream;
  /** Retourne l'horodatage actuel en millisecondes depuis l'époque Unix. */
  function hrtime(): i64;
}

// ============================================================
// § SYMBOL
// ============================================================

declare class Symbol {
  static readonly hasInstance: symbol;
  static readonly concatSpreadable: symbol;
  static readonly iterator: symbol;
  static readonly match: symbol;
  static readonly replace: symbol;
  static readonly search: symbol;
  static readonly species: symbol;
  static readonly split: symbol;
  static readonly toPrimitive: symbol;
  static readonly toStringTag: symbol;
  static readonly unscopables: symbol;
  static for(key: string): symbol;
  toString(): string;
}
declare type symbol = Symbol;

// ============================================================
// § RE-EXPORT des groupes de types (depuis assemblyscript.d.ts)
// ============================================================

// Ces types sont déclarés dans assemblyscript.d.ts et utilisés ici.
// On les re-documente pour la lisibilité de l'ensemble du fichier.

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
