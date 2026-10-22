/**
 * Retire les `/` finaux d'une adresse, en temps linéaire.
 *
 * `value.replace(/\/+$/, "")` est QUADRATIQUE sur une chaîne faite de longues
 * suites de `/` suivies d'autre chose (le moteur réessaie la suite depuis chaque
 * position) — CodeQL `js/polynomial-redos`. Une adresse tapée ou servie par un
 * tiers ne doit pas pouvoir figer l'interface : on remonte la chaîne à la main.
 */
export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47 /* « / » */) end--;
  return end === value.length ? value : value.slice(0, end);
}
