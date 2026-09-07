/**
 * Comment le snapshot va chercher une ressource sur le serveur.
 *
 * # Pourquoi une fonction injectée plutôt qu'un appel direct
 *
 * `meta`, `subs`, `trickplay` et `segments` sont de la logique : quelle URL
 * construire, quoi enregistrer, quoi faire d'un échec. Rien de tout cela ne
 * demande Electron — et tout se teste, à condition que le réseau entre par la
 * porte. Côté Rust, `ureq::Agent` jouait déjà ce rôle, passé en argument.
 *
 * L'implémentation réelle vit dans `netFetch.ts`, seul fichier de cette couche
 * à importer `electron`.
 */

/**
 * Récupère une ressource, ou `null` si elle n'est pas venue.
 *
 * `null` couvre TOUS les échecs — réseau, 404, corps illisible — et c'est
 * voulu : chaque appelant est best-effort, aucun ne distingue les cas, et un
 * snapshot incomplet ne doit jamais empêcher un média de se télécharger.
 *
 * `maxBytes` borne la lecture : ces ressources sont des JSON et des vignettes,
 * pas des médias.
 */
export type FetchBytes = (url: string, maxBytes: number) => Promise<Uint8Array | null>;

/** Plafonds hérités du Rust, par nature de ressource. */
export const MAX_JSON_BYTES = 20 * 1024 * 1024;
export const MAX_SUBTITLE_BYTES = 15 * 1024 * 1024;
export const MAX_TILE_BYTES = 6 * 1024 * 1024;
