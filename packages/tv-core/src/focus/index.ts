/** La géométrie du déplacement au D-pad.
 *
 * Seule la géométrie est ici. Le moteur qui l'utilise pour parcourir le DOM
 * reste dans la cible webOS : Apple TV et Android TV résolvent nativement le
 * déplacement du focus, et n'ont besoin que du calcul — pour décider d'un
 * défilement, par exemple.
 *
 * `sections.ts` : la règle HAUT / BAS entre sections (la section voisine, au
 * plus proche centre à centre), que l'Apple TV traduit nativement. */
export * from "./geometry";
export * from "./sections";
