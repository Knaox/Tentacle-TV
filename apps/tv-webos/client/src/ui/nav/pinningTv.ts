import {
  createRailPinningStore,
  createUseRailPinning,
  type RailPinning,
} from "@tentacle-tv/tv-core";

/**
 * Le rail de la LG, branché sur le magasin d'épinglage partagé.
 *
 * La politique — liste d'exclusion plutôt que d'épinglage, repli sur « tout
 * afficher » quand le stockage est illisible, notification des abonnés — vit
 * dans `@tentacle-tv/tv-core` et sert aussi Apple TV et Android TV. Ne reste
 * ici que le choix du stockage.
 *
 * `localStorage` convient tel quel : le magasin n'attend qu'un `getItem` et un
 * `setItem` synchrones. C'est aussi ce qu'offre `RNStorageAdapter` côté natif,
 * une fois hydraté — d'où un magasin unique pour les trois cibles.
 */
const magasin = createRailPinningStore(localStorage);

export const useEpinglageRail = createUseRailPinning(magasin);
export type { RailPinning };
