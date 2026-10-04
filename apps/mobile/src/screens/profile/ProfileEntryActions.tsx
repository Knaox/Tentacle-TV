import { createContext, useContext, type ReactNode } from "react";
import { useProfileActions } from "@/hooks/useProfileActions";

type ProfileActions = ReturnType<typeof useProfileActions>;

const ProfileActionsContext = createContext<ProfileActions | null>(null);

/**
 * Les actions de compte (déconnexion, serveur, cache, suppression), montées
 * UNE fois par écran de profil et lues par chaque ligne d'action — pas un
 * jeu de crochets (session, titres gardés, mutations) par ligne.
 */
export function ProfileActionsProvider({ value, children }: { value: ProfileActions; children: ReactNode }) {
  return <ProfileActionsContext.Provider value={value}>{children}</ProfileActionsContext.Provider>;
}

export function useProfileEntryActions(): ProfileActions {
  const actions = useContext(ProfileActionsContext);
  if (!actions) throw new Error("useProfileEntryActions hors de ProfileActionsProvider");
  return actions;
}
