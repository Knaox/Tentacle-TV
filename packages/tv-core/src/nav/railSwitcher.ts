/**
 * « Changer de profil » dans le rail (Apple TV, Android TV, Famille) — ce que
 * son pictogramme dit. Module pur.
 *
 * Le pictogramme est la photo du profil CONNECTÉ, et une pastille « +N » où N
 * compte les AUTRES profils que « Qui regarde ? » propose sur cette TV : on
 * voit qui regarde, et qu'il y a d'autres profils derrière. Seul sur la TV :
 * la photo, sans pastille. Profil connecté introuvable dans la liste (pas
 * encore lue, ou un profil retiré entre-temps) : pas de photo, la pastille
 * compte tous les profils listés.
 */

/** Au-delà, la pastille dit « +99 » : elle garde sa largeur d'un chiffre ou deux. */
export const RAIL_SWITCHER_BADGE_MAX = 99;

export interface RailSwitcherSummary<T> {
  /** Le profil connecté, tel que la liste le donne ; null s'il n'y figure pas. */
  current: T | null;
  /** Les autres profils proposés sur cette TV. */
  others: number;
  /** Le texte de la pastille (« +2 »), ou null : pas de pastille. */
  badge: string | null;
}

export function railSwitcherSummary<T extends { id: string }>(profiles: readonly T[], currentId: string | null): RailSwitcherSummary<T> {
  const current = currentId === null ? null : (profiles.find((profile) => profile.id === currentId) ?? null);
  const others = profiles.filter((profile) => profile !== current).length;
  return { current, others, badge: others > 0 ? `+${Math.min(others, RAIL_SWITCHER_BADGE_MAX)}` : null };
}
