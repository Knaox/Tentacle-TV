import type { NotificationFilter } from "./notificationGroups";

/**
 * Les règles du centre de notifications paginé (mobile, web étroit), pures.
 *
 * Le nombre de non lues AFFICHÉ (en-tête, filtre, « Tout marquer comme lu ») :
 * celui du serveur, mais jamais moins que les non lues déjà à l'écran — un
 * compteur en retard (relevé de 30 s, réponse perdue) masquait « Tout
 * marquer comme lu » sous des lignes encore non lues.
 */
export function centerUnreadCount(serverCount: number | undefined, loaded: ReadonlyArray<{ read: boolean }>): number {
  const visible = loaded.reduce((sum, n) => sum + (n.read ? 0 : 1), 0);
  return Math.max(serverCount ?? 0, visible);
}

/**
 * Charger la page suivante d'office ? Sous « Non lues », tant que le serveur
 * compte plus de non lues qu'il n'y en a de chargées et qu'il reste des
 * pages : sinon le filtre disait « rien de non lu » (ou en montrait trois)
 * pendant que la pastille en annonçait douze, plus bas dans la liste.
 */
export function centerShouldFillUnread(input: {
  filter: NotificationFilter;
  serverCount: number | undefined;
  loaded: ReadonlyArray<{ read: boolean }>;
  hasMore: boolean;
  loading: boolean;
}): boolean {
  const { filter, serverCount, loaded, hasMore, loading } = input;
  if (filter !== "unread" || !hasMore || loading || serverCount === undefined) return false;
  return loaded.filter((n) => !n.read).length < serverCount;
}

/**
 * L'état vide (« Vous êtes à jour », « Rien de non lu ») n'est vrai qu'une
 * fois la liste lue ET qu'aucune page n'est en route pour la remplir.
 */
export function centerShowsEmpty(input: { visibleCount: number; loaded: boolean; filling: boolean }): boolean {
  return input.loaded && !input.filling && input.visibleCount === 0;
}
