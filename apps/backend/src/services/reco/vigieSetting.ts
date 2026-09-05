/**
 * Le réglage « inclure les titres hors bibliothèque » n'a de sens que si le
 * plugin Vigie est présent, activé et configuré : sans lui, un titre hors
 * bibliothèque n'a nulle part où mener (le client grise la carte, le bouton
 * « demander » n'existe pas). Le réglage STOCKÉ est conservé tel quel — il
 * reprend effet quand le plugin revient — mais le moteur ne le lit qu'à
 * travers cette fonction.
 */
export function effectiveIncludeVigie(stored: boolean | null | undefined, vigieAvailable: boolean): boolean {
  return (stored ?? true) && vigieAvailable;
}
