import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { reportAccountAccess, useAuth } from "@tentacle-tv/api-client";
import { isDesktopApp } from "../desktop/detect";
import { useAccountLogout } from "../auth/useAccountLogout";
import { endProfileSession } from "../auth/profileEnded";
import { useActiveProfile } from "../auth/profileSession";

export type AccountAccessAction = "switchProfile" | "signOut" | "changeServer";

/**
 * Les sorties de la page d'un compte bloqué (§ 9.1). Une session de profil du
 * bureau (un invité de la Famille) : « Changer de profil » — retour au compte,
 * puis « Qui regarde ? ». Sinon : « Se déconnecter » (la session du compte se
 * ferme sur le serveur, retour à la connexion), et sur le bureau « Changer de
 * serveur ». La première est l'action principale.
 */
export function useAccountAccessActions(): { actions: AccountAccessAction[]; run: (action: AccountAccessAction) => void } {
  const profile = useActiveProfile();
  const signOut = useAccountLogout();
  const { changeServer } = useAuth();
  const navigate = useNavigate();

  const run = useCallback(
    (action: AccountAccessAction) => {
      // La page se lève : l'état bloqué n'appartient plus à la session qui vient.
      const leave = () => reportAccountAccess({ state: "allowed" });
      if (action === "switchProfile") {
        leave();
        endProfileSession("access");
        return;
      }
      if (action === "changeServer") {
        changeServer.mutate(undefined, { onSettled: () => window.location.reload() });
        return;
      }
      signOut(() => {
        leave();
        navigate("/login", { replace: true });
      });
    },
    [changeServer, navigate, signOut],
  );

  const actions: AccountAccessAction[] = profile ? ["switchProfile"] : isDesktopApp() ? ["signOut", "changeServer"] : ["signOut"];
  return { actions, run };
}
