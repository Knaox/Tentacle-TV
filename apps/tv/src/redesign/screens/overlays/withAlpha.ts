/**
 * Une couleur des jetons (#rrggbb) à l'alpha voulu : les teintes des
 * surimpressions (le rose de l'accent, le rouge d'erreur) se dérivent des
 * jetons au lieu d'être recopiées.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
