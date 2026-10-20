/**
 * La session de profil de la Famille, vue de la page d'un compte bloqué.
 *
 * Branchement à la FUSION avec `claude/famille-20ba01` (famille-mobile) :
 * `useIsProfileSession` → `useActiveProfile() !== null`
 * (`@/family/profiles/profileSessionState`) et `endProfileSessionForAccess` →
 * le retour au compte puis « Qui regarde ? » de `switchSession.ts`. D'ici là :
 * jamais une session de profil, rien à quitter.
 */
export function useIsProfileSession(): boolean {
  return false;
}

export function endProfileSessionForAccess(): void {
  // Branché à la fusion (voir l'en-tête).
}
