/**
 * ============================================================
 * Template as_type.d.ts pour utilisateurs du package
 * ============================================================
 *
 * Copiez ce fichier à la racine de votre projet qui utilise
 * bun-assemblyscript pour centraliser vos importations de type.
 *
 * Reference the path to your installed bun-assemblyscript package:
 * - Locale : ./node_modules/bun-assemblyscript/dist/assemblyscript.d.ts
 * - Path alias (si configuré)
 */

/// <reference path="./node_modules/bun-assemblyscript/dist/assemblyscript.d.ts" />

/**
 * ============================================================
 * AssemblyScript Type Reference
 * ============================================================
 *
 * Ce fichier sert de fichier de référence central pour le typage
 * AssemblyScript dans le projet.
 *
 * Tous les fichiers .as peuvent référencer ce fichier pour avoir
 * accès aux types AssemblyScript avec un chemin simple.
 *
 * Usage: En ajoutant cette ligne en haut de chaque fichier .as :
 *
 *   /// <reference path="../as_type.d.ts" />
 *
 * Les types AssemblyScript seront automatiquement disponibles :
 * - Entiers: i8, i16, i32, i64, isize, u8, u16, u32, u64, usize
 * - Flottants: f32, f64
 * - Booléen: bool
 * - Collections: Array<T>, ArrayBuffer, DataView
 * - Types spéciaux: String, Map<K,V>, Set<T>, StaticArray<T,N>
 *
 * ============================================================
 */

// Vous pouvez également ajouter vos propres types et déclarations globales ici
declare global {
  // Exemple : interfaces ou types personnalisées
  // interface MyCustomType { ... }
}
