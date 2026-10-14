import type { PluginTrailerPreviewEnv } from "./pluginTrailerPreview";

/** Environnement hôte exposé aux plugins (iframe sandboxée = aucun accès à la
 * window parente ni aux marqueurs du shell). */
export interface PluginHostEnv {
  /** Shell Tauri précisément. Conservé tel quel : les greffons déjà publiés
   *  s'en servent, en changer le sens les casserait silencieusement. */
  tauri: boolean;
  /** Application de bureau, quel que soit le shell. À préférer à `tauri` pour
   *  toute question du genre « ai-je une origine applicative sans referrer
   *  HTTP, un catalogue local, des commandes natives ». */
  desktop: boolean;
  mac: boolean;
  prod: boolean;
  backendUrl: string;
  /** Query string de la route hôte au montage (« ?media=movie:603 ») —
   *  deep-link vers un contenu du plugin. Champ ADDITIF de l'API publique :
   *  absent chez les hôtes d'avant, les greffons doivent le traiter optionnel. */
  query?: string;
  /** Les aperçus de bande-annonce sur cet appareil (`pluginTrailerPreview.ts`),
   *  tenu à jour par le pont. ADDITIF : absent chez les hôtes d'avant. */
  trailerPreview?: PluginTrailerPreviewEnv;
  /** L'hôte ouvre son lecteur complet sur le catalogue d'un titre
   *  (`__tentacle_bridge.openTrailerFor`, `pluginTrailerCatalog.ts`). ADDITIF :
   *  absent ou faux, l'extension garde `openTrailer`. */
  trailerCatalog?: boolean;
  /** L'hôte lit les octets du relais des bandes-annonces (`fetchMedia`,
   *  `pluginMediaBridge.ts`) : le cadre ne joint plus un serveur local. ADDITIF. */
  mediaBridge?: boolean;
}
