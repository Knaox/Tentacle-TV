import { useCallback } from "react";
import { useActiveProfile } from "@/family/profiles/profileSessionState";
import { useEndProfileSession } from "@/family/profiles/useEndProfileSession";

/**
 * La session de profil de la Famille, vue de la page d'un compte bloqué : en
 * session de profil, « Changer de profil » ramène à la session du compte, puis
 * à l'accueil, et « Qui regarde ? » s'affiche de lui-même (famille-mobile).
 */
export function useIsProfileSession(): boolean {
  return useActiveProfile() !== null;
}

export function useEndProfileSessionForAccess(): () => void {
  const end = useEndProfileSession();
  return useCallback(() => {
    end("access");
  }, [end]);
}
