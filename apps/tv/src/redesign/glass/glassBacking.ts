import type { GlassTone } from "./GlassSurface";
import { useGlassRendering } from "./liquidGlassMode";

/**
 * Le fond posé SOUS un verre qui flotte sur une image ou sur une page — une
 * seule règle pour toute la refonte.
 *
 * Verre DESSINÉ (simulé sur tvOS 17–18, enrichi quand Liquid Glass est
 * coupé) : il ne floute rien. Ce qui passe derrière — le texte d'une page, une
 * grille d'affiches, l'image du film — se lirait au travers et brouillerait
 * les libellés : chaque vue pose son propre fond sombre, presque opaque sous
 * ce qu'on lit longtemps, voilé sous une pastille d'un instant. Ces fonds-là
 * ne changent pas.
 *
 * Verre NATIF (tvOS 26) : il floute, et il fonce déjà ce qu'il couvre, plus ou
 * moins selon son ton. Le fond ne fait que compléter, juste assez pour que le
 * texte blanc tienne sur l'image la plus claire qui soit, le blanc pur ; plus
 * dense, il cacherait ce que le verre floute — feuilles et panneaux sortaient
 * presque noirs. Mesuré au simulateur tvOS 26.2 (scène `verre/lisibilite` du
 * banc), contraste du texte blanc sur du blanc pur :
 * - `strong` fonce assez seul : 6,7:1 sans fond (4,8:1 pour le texte
 *   secondaire) — aucun fond ;
 * - `regular` : 4,1:1 sans fond — 0,1 le porte à 4,7:1 ;
 * - `clear` ne fonce rien (blanc sur blanc, 1:1) — 0,55 le porte à 3,1:1 ;
 *   il ne porte que des libellés gras et des pictogrammes.
 */

/** L'opacité du fond sous le verre natif, par ton. */
export const NATIVE_GLASS_BACKING_ALPHA: Readonly<Record<GlassTone, number>> = {
  strong: 0,
  regular: 0.1,
  clear: 0.55,
};

const backingOf = (tone: GlassTone) => ({ backgroundColor: `rgba(10, 10, 14, ${NATIVE_GLASS_BACKING_ALPHA[tone]})` });

// Des objets stables : le style d'une vue ne change pas d'un rendu à l'autre.
const NATIVE_BACKING: Readonly<Record<GlassTone, { backgroundColor: string }>> = {
  strong: backingOf("strong"),
  regular: backingOf("regular"),
  clear: backingOf("clear"),
};

/**
 * Sous le verre natif, le fond qui REMPLACE celui qu'une vue dessine sous un
 * verre de ton `tone` — à poser après lui : `[styles.base, backing]`. `null`
 * sous un verre dessiné : la vue garde son fond.
 */
export function useNativeGlassBacking(tone: GlassTone): { backgroundColor: string } | null {
  return useGlassRendering() === "native" ? NATIVE_BACKING[tone] : null;
}
