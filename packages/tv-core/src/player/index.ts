/** Les machines du lecteur, communes aux trois cibles.
 *
 * Ces valeurs — 250 ms de tic, paliers ×1/×2/×4/×8 toutes les secondes, 7 s
 * d'inactivité avant annulation — étaient déjà identiques côté LG et côté
 * natif, recopiées à la main. Elles n'existent plus qu'ici. */
export * from "./scrubMachine";
export * from "./holdMotor";
export * from "./arrowArbiter";
export * from "./playerState";
