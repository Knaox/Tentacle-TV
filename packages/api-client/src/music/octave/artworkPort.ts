/**
 * Octave — le PORT des pochettes : chaque plateforme sait résoudre une adresse
 * (proxy, taille) et la DÉCODER d'avance — `HTMLImageElement.decode()` sur le
 * web, le cache d'`expo-image` sur le mobile. Les crochets des pages n'en
 * connaissent que cette promesse, bornée par `budgetMs` : au-delà, la page
 * part quand même et l'image arrive en fondu à sa place.
 */

export type ArtworkPreloader = (urls: readonly (string | null | undefined)[], budgetMs: number) => Promise<void>;

/** Aucun préchargement (tests, plateforme sans cache) : la révélation n'attend aucune image. */
export const noArtworkPreload: ArtworkPreloader = () => Promise.resolve();
