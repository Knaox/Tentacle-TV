/**
 * Watch Together mobile — quand la boîte des invitations reçues s'ouvre
 * d'elle-même, en module PUR (la règle du web, `WatchTogetherProvider`) :
 * à l'ACCUEIL seulement, là où l'on ne fait rien de précis — jamais sur le
 * lecteur ni par-dessus une fiche qu'on lit —, une fois les recouvrements du
 * démarrage tus (Famille, avatars, PIN…), et une seule fois par invitation.
 * Ailleurs, la bande de l'accueil et la feuille du groupe la gardent sous la main.
 */

export function isHomePath(pathname: string): boolean {
  return pathname === "/" || pathname === "/index" || pathname === "/(tabs)";
}

export function isPlayerPath(pathname: string): boolean {
  return pathname.startsWith("/watch/");
}

export function shouldAutoOpenInbox({ pathname, startupQuiet, inviteIds, shownIds }: {
  pathname: string;
  startupQuiet: boolean;
  inviteIds: readonly string[];
  /** Les invitations déjà présentées (ouverte ou refermée sans réponse). */
  shownIds: ReadonlySet<string>;
}): boolean {
  if (!startupQuiet || !isHomePath(pathname)) return false;
  return inviteIds.some((id) => !shownIds.has(id));
}
