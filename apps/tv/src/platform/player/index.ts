/**
 * Le POINT D'ENTRÉE NEUTRE des applicateurs du lecteur : ce que le câblage
 * importe, sans savoir sur quelle plateforme il tourne. Ce fichier est celui
 * de l'Apple TV (la base : tsc le lit, Metro le prend sur tvOS) ;
 * `index.android.ts`, son jumeau, sert Android TV avec les MÊMES noms — un
 * nom nouveau s'ajoute aux deux (même règle que `platform/input`).
 */
export * from "../tvos/player";
