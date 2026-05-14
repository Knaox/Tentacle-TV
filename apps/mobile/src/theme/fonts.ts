/**
 * Chargement de la police Inter via `expo-font` + `@expo-google-fonts/inter`.
 *
 * Inter est la police signature du nouveau langage cinématographique (alignée
 * avec apps/web qui l'importe depuis Google Fonts). Mobile la charge en local
 * via le package `@expo-google-fonts/inter` qui expose les .ttf bundlés.
 *
 * Le `useAppFonts` hook est consommé par `app/_layout.tsx` qui gate le splash
 * tant que `fontsLoaded === false && !fontError`.
 */

import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

/** Map de toutes les fontFamilies Inter requises par les `TYPE_PRESETS`. */
export const INTER_FONTS = {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} as const;

/**
 * Hook qui charge toutes les variantes Inter au boot de l'app.
 * Retourne `[fontsLoaded, fontError]`. À utiliser dans `_layout.tsx` :
 *
 * ```tsx
 * const [fontsLoaded, fontError] = useAppFonts();
 * if (!fontsLoaded && !fontError) return null; // splash reste affiché
 * ```
 */
export function useAppFonts(): readonly [boolean, Error | null] {
  return useFonts(INTER_FONTS);
}
