/**
 * L'avancement qu'une carte ou une ligne du miroir dessine (`ProgressBar`),
 * de 0 à 1 — ou `null` : pas de barre.
 *
 * Un titre VU n'en porte pas, même revu en partie : la coche le dit déjà
 * (la règle de `PosterTile` au bureau). Un titre à 100 % non plus — c'est
 * l'état qu'une coche optimiste pose sur son `UserData`, et une barre pleine
 * sur une carte cochée se lisait comme « presque fini ».
 */
export function cardProgress(userData: { Played?: boolean; PlayedPercentage?: number | null } | null | undefined): number | null {
  if (!userData || userData.Played === true) return null;
  const percent = userData.PlayedPercentage;
  if (percent == null || !Number.isFinite(percent) || percent <= 0 || percent >= 100) return null;
  return percent / 100;
}
