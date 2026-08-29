/**
 * Le format d'un refus de build, partagé par les deux gardes.
 *
 * `compatGuard` inspecte la feuille produite, `inlineStyleGuard` inspecte les
 * attributs `style` des modules du bundle. Elles refusent la même chose pour la
 * même raison, et doivent le dire de la même façon — quelqu'un qui découvre le
 * sujet dans six mois ne devrait pas avoir à reconnaître deux mises en page de
 * message avant de comprendre qu'il s'agit du même sujet.
 *
 * Vingt lignes au plus : au-delà, on ne lit plus, on fait défiler.
 */
const MAX_LINES = 20;

export function formatRefusal(header: string, lines: string[], footer: string[]): string {
  const rest = lines.length > MAX_LINES
    ? `\n  … et ${lines.length - MAX_LINES} autres`
    : "";

  return [header, ...lines.slice(0, MAX_LINES), rest, "", ...footer].join("\n");
}
