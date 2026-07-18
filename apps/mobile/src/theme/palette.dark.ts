/**
 * Palette sombre — REMONTÉE dans `@tentacle-tv/theme` (`src/schemes/dark.ts`),
 * désormais partagée avec le web et le desktop. Ce fichier n'est qu'un
 * ré-export de compatibilité : les valeurs et le comportement sont inchangés.
 *
 * Le builder lit toujours les exports mutables de `@tentacle-tv/shared/theme`
 * après `applyThemeOverride()` — voir l'INVARIANT documenté à la source.
 */

export { buildDarkPalette } from "@tentacle-tv/theme";
