/**
 * Le format d'un refus de build, partagé par les deux gardes.
 *
 * `gardeCompat` inspecte la feuille produite, `gardeStylesEnLigne` inspecte les
 * attributs `style` des modules du bundle. Elles refusent la même chose pour la
 * même raison, et doivent le dire de la même façon — quelqu'un qui découvre le
 * sujet dans six mois ne devrait pas avoir à reconnaître deux mises en page de
 * message avant de comprendre qu'il s'agit du même sujet.
 *
 * Vingt lignes au plus : au-delà, on ne lit plus, on fait défiler.
 */
const MAXIMUM_LIGNES = 20;

export function formaterRefus(entete: string, lignes: string[], renvoi: string[]): string {
  const reste = lignes.length > MAXIMUM_LIGNES
    ? `\n  … et ${lignes.length - MAXIMUM_LIGNES} autres`
    : "";

  return [entete, ...lignes.slice(0, MAXIMUM_LIGNES), reste, "", ...renvoi].join("\n");
}
