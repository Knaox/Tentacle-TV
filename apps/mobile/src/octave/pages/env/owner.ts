/**
 * Octave mobile — à qui appartient la mémoire des pages (pages consultées) :
 * `serveur|compte`, le compte lu dans `tentacle_user` (un profil de la Famille
 * compris). Sans serveur ni session : personne, rien de gardé ni de rendu.
 * Module pur.
 */

export function octaveOwnerOf(serverUrl: string | null, rawUser: string | null): string | null {
  if (!serverUrl || !rawUser) return null;
  try {
    const id = (JSON.parse(rawUser) as { Id?: unknown }).Id;
    return typeof id === "string" && id ? `${serverUrl}|${id}` : null;
  } catch {
    return null;
  }
}
