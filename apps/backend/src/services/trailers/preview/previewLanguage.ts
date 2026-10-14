/* ------------------------------------------------------------------ */
/*  La langue d'un aperçu : celle du SERVEUR                           */
/*                                                                     */
/*  Les métadonnées de Jellyfin disent la langue de la maison (« fr »  */
/*  → la VF d'abord ; « en » → la VO anglaise d'abord), la même que     */
/*  les titres hors bibliothèque (`reco/titleLanguage.ts`). Celle de    */
/*  l'interface du client ne sert qu'à défaut : Jellyfin muet, ou une   */
/*  langue qu'il ne dit pas.                                           */
/* ------------------------------------------------------------------ */

import { refreshTitleLanguage, titleLanguage } from "../../reco/titleLanguage";

/** La langue principale (« fr ») qui classe les bandes-annonces d'un aperçu. */
export async function previewLanguage(clientLang: string | undefined): Promise<string | undefined> {
  const server = await refreshTitleLanguage().catch(() => titleLanguage());
  return server ? server.slice(0, 2).toLowerCase() : clientLang;
}
