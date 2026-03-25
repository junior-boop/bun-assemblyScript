/**
 * Types globaux AssemblyScript (primitives)
 * Cela permet à l'éditeur de reconnaître i32, f64, etc. dans les fichiers .as
 * sans entrer en conflit avec les types TypeScript standards (String, Array).
 */
declare type i8 = number;
declare type i16 = number;
declare type i32 = number;
declare type i64 = bigint;
declare type isize = number;
declare type u8 = number;
declare type u16 = number;
declare type u32 = number;
declare type u64 = bigint;
declare type usize = number;
declare type f32 = number;
declare type f64 = number;
declare type bool = boolean;
declare type v128 = never;
declare type anyref = any;
declare type externref = any;

declare module "*.as" {
  const exports: Record<string, unknown>;
  export default exports;
}
