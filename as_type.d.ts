/// <reference path="./assemblyscript.d.ts" />

/**
 * ============================================================
 * AssemblyScript Type Reference
 * ============================================================
 *
 * Ce fichier sert de fichier de référence central pour le typage
 * AssemblyScript dans le projet.
 *
 * Tous les fichiers .as peuvent référencer ce fichier pour avoir
 * accès aux types AssemblyScript.
 *
 * En ajoutant cette ligne en haut de chaque fichier .as :
 * /// <reference path="../as_type.d.ts" />
 *
 * Les types AssemblyScript seront automatiquement disponibles :
 * - Entiers signés: i8, i16, i32, i64, isize
 * - Entiers non-signés: u8, u16, u32, u64, usize
 * - Flottants: f32, f64
 * - Booléen: bool
 * - Collections: Array<T>, ArrayBuffer, DataView
 * - Types spéciaux: String, Map<K,V>, Set<T>, StaticArray<T,N>
 *
 * ============================================================
 */

// Ré-export des types AssemblyScript principaux
export type {
  // Entiers signés
  i8,
  i16,
  i32,
  i64,
  isize,
  // Entiers non-signés
  u8,
  u16,
  u32,
  u64,
  usize,
  // Flottants
  f32,
  f64,
  // Booléen
  bool,
  // SIMD et références
  v128,
  anyref,
  externref,
} from "./assemblyscript";

// Export de la déclaration globale pour les éléments intrinsèques
declare global {
  // Entiers signés
  type i8 = import("./assemblyscript").i8;
  type i16 = import("./assemblyscript").i16;
  type i32 = import("./assemblyscript").i32;
  type i64 = import("./assemblyscript").i64;
  type isize = import("./assemblyscript").isize;

  // Entiers non-signés
  type u8 = import("./assemblyscript").u8;
  type u16 = import("./assemblyscript").u16;
  type u32 = import("./assemblyscript").u32;
  type u64 = import("./assemblyscript").u64;
  type usize = import("./assemblyscript").usize;

  // Flottants
  type f32 = import("./assemblyscript").f32;
  type f64 = import("./assemblyscript").f64;

  // Booléen
  type bool = import("./assemblyscript").bool;

  // SIMD / Références
  type v128 = import("./assemblyscript").v128;
  type anyref = import("./assemblyscript").anyref;
  type externref = import("./assemblyscript").externref;
}
