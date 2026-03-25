# AS Types Configuration Guide

## 📋 Vue d'ensemble

Le fichier `as_type.d.ts` à la racine du projet centralise toutes les références de typage AssemblyScript pour le projet. Cela permet à tous les fichiers `.as` d'avoir accès aux types AssemblyScript sans dupliquer les références.

## 🎯 Utilisation

### Pour les fichiers `.as` dans le projet racine :

```typescript
/// <reference path="./as_type.d.ts" />

export function add(a: i32, b: i32): i32 {
  return (a + b) as i32;
}
```

### Pour les fichiers `.as` en sous-dossiers :

Ajustez le chemin relatif selon la position du fichier :

```typescript
// Pour un fichier dans src/
/// <reference path="../as_type.d.ts" />

// Pour un fichier dans src/utils/
/// <reference path="../../as_type.d.ts" />

// Pour un fichier dans test/fixtures/
/// <reference path="../../as_type.d.ts" />
```

## 📦 Types disponibles

Une fois la référence incluée, vous avez accès à :

### Entiers signés
- `i8` : 8-bit signed integer (-128 à 127)
- `i16` : 16-bit signed integer (-32,768 à 32,767)
- `i32` : 32-bit signed integer (-2,147,483,648 à 2,147,483,647)
- `i64` : 64-bit signed integer
- `isize` : Platform-dependant signed integer

### Entiers non-signés
- `u8` : 8-bit unsigned integer (0 à 255)
- `u16` : 16-bit unsigned integer (0 à 65,535)
- `u32` : 32-bit unsigned integer (0 à 4,294,967,295)
- `u64` : 64-bit unsigned integer
- `usize` : Platform-dependant unsigned integer

### Flottants
- `f32` : 32-bit IEEE 754 floating point
- `f64` : 64-bit IEEE 754 floating point

### Booléen
- `bool` : 1-bit boolean (true/false)

### Types spéciaux
- `v128` : 128-bit SIMD vector type
- `anyref` : Object reference type
- `externref` : External object reference type
- `String` : AssemblyScript String type
- `Array<T>` : Dynamic array type
- `Map<K, V>` : Hash map type
- `Set<T>` : Hash set type
- `StaticArray<T, N>` : Fixed-size array type

## 🔄 Distribution du package

Lorsque le package est installé via npm/bun, le fichier `as_type.d.ts` n'est pas inclus par défaut. 

Pour les utilisateurs qui installent `bun-assemblyscript`, ils doivent créer leur propre `as_type.d.ts` à la racine de leur projet avec le contenu du fichier d'exemple fourni.

### Alternatively, créez un script de setup :

```bash
<?xml version="1.0" encoding="UTF-8"?>
# postinstall.ts
const asTypeContent = `/// <reference path="./node_modules/bun-assemblyscript/dist/assemblyscript.d.ts" />
...`;
```

## ✅ Avantages du système centralisé

1. **Point unique de configuration** : Tous les fichiers `.as` référencent un seul fichier
2. **Maintenabilité** : Facile d'ajouter ou modifier les types
3. **Cohérence** : Garantit que tous les fichiers utilisent les mêmes définitions
4. **Documentation** : Le fichier peut contenir des commentaires et exemples
5. **Compatibilité** : Compatible avec les éditeurs TypeScript/AssemblyScript

## 🔗 Références additionnelles

- [Documentation AssemblyScript](https://www.assemblyscript.org/)
- [Types AssemblyScript](https://www.assemblyscript.org/types.html)
- [Standard Library](https://www.assemblyscript.org/stdlib)
