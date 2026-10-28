/**
 * L'onglet actif d'Octave d'après l'adresse : l'accueil seulement sur lui-même
 * (`end`), une destination sur elle et ses sous-pages. -1 hors des onglets.
 */
export function activeDestinationIndex(pathname: string, destinations: ReadonlyArray<{ to: string; end: boolean }>): number {
  const path = pathname.replace(/\/+$/, "") || "/";
  return destinations.findIndex(({ to, end }) => {
    const base = to.replace(/\/+$/, "") || "/";
    return end ? path === base : path === base || path.startsWith(`${base}/`);
  });
}
