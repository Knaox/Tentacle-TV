/**
 * La session de profil de la Famille, vue de la page d'un compte bloqué.
 *
 * Branchement à la FUSION avec `claude/famille-20ba01` (famille-mobile, 7d0450914) :
 * - `useIsProfileSession` → `useActiveProfile() !== null` (`@/family/profiles/profileSessionState`) ;
 * - `useEndProfileSessionForAccess` → `const end = useEndProfileSession(); return () => end("access");`
 *   (`@/family/profiles/useEndProfileSession`) : retour à la session du compte, puis l'accueil,
 *   et « Qui regarde ? » s'affiche de lui-même.
 * D'ici là : jamais une session de profil, rien à quitter.
 */
export function useIsProfileSession(): boolean {
  return false;
}

export function useEndProfileSessionForAccess(): () => void {
  return () => undefined;
}
