/**
 * D'où part une demande — facultatif et additif, dans le contrat `titles`
 * (`pluginTitles.ts` ; `pluginTitlesMeta.ts` côté serveur) :
 *
 *   POST request { mediaType, tmdbId, lang, seasons?, origin: "tv", platform: "appletv" }
 *     l'extension garde l'origine avec la demande ;
 *   GET  mine?lang=fr&origin=tv
 *     les titres attendus de cette origine seulement — sans `origin`, tous,
 *     comme avant (`pluginTitlesMine.ts`).
 *
 * Une seule origine pour l'instant : « tv », n'importe quel téléviseur — la
 * règle des téléviseurs vit dans tv-core (`tvRequestOrigin`). La plateforme
 * est gardée pour plus tard : rien ne filtre dessus. Une extension d'avant
 * ignore les deux : la demande part sans origine, et `mine` rend toute la
 * liste.
 */

/** « tv » : demandé depuis un téléviseur, quel qu'il soit. */
export type TitleOrigin = "tv";

/** Les origines que ce client connaît. */
export const TITLE_ORIGINS: readonly TitleOrigin[] = ["tv"];

export function isTitleOrigin(value: unknown): value is TitleOrigin {
  return typeof value === "string" && (TITLE_ORIGINS as readonly string[]).includes(value);
}

/** Le téléviseur qui a demandé, gardé pour plus tard. */
export type TitlePlatform = "appletv" | "androidtv" | "webos";

export interface TitleRequestOrigin {
  origin: TitleOrigin;
  platform: TitlePlatform;
}

/** Le corps du geste « demander » : ses champs, et l'origine quand le client la dit. */
export function titleRequestBody(fields: Record<string, unknown>, origin?: TitleRequestOrigin | null): string {
  return JSON.stringify(origin ? { ...fields, origin: origin.origin, platform: origin.platform } : fields);
}
