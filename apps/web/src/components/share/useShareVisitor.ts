import { useMemo } from "react";

export interface ShareVisitor {
  /** Une session Tentacle existe dans ce navigateur. */
  authed: boolean;
  /** Connexion qui ramène ici (`?redirect=` est lu par les deux écrans de connexion). */
  loginPath: string;
  /** Inscription par invitation, qui ramène ici après la connexion. */
  registerPath: string;
}

/**
 * Qui regarde un partage, et par où il rejoint le serveur. Le jeton de
 * session n'est pas lu : la présence de l'utilisateur (`tentacle_user`,
 * clé de stockage à ne pas renommer) suffit à choisir l'interface.
 */
export function useShareVisitor(returnTo: string): ShareVisitor {
  return useMemo(() => {
    let authed: boolean;
    try {
      authed = typeof localStorage !== "undefined" && !!localStorage.getItem("tentacle_user");
    } catch {
      // Stockage refusé (navigation privée stricte) : un visiteur comme un autre.
      authed = false;
    }
    const redirect = encodeURIComponent(returnTo);
    return {
      authed,
      loginPath: `/login?redirect=${redirect}`,
      registerPath: `/register?redirect=${redirect}`,
    };
  }, [returnTo]);
}
