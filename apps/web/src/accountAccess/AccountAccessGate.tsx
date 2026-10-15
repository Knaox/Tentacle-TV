import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAccountAccess, useUserId } from "@tentacle-tv/api-client";
import { endPipSession } from "../pictureInPicture/pictureInPictureStore";
import { AccountAccessPage } from "./AccountAccessPage";

/**
 * La porte de l'accès du compte, web et bureau (docs/DROITS-UTILISATEURS.md
 * § 9.1) : montée UNE fois, à la racine (`main.tsx`), autour de l'application.
 * Compte désactivé ou hors plage : la page REMPLACE l'application — rien
 * par-dessus, ni nouveautés, ni avatar, ni PIN, et tout ce qu'elle tenait est
 * démonté, la lecture d'abord (lecteur web, mpv du bureau, PiP, miroir).
 * Revenu, l'application remonte là où l'on était — jamais dans le lecteur.
 */
export function AccountAccessGate({ children }: { children: ReactNode }) {
  const blocked = useAccountAccess({ enabled: useUserId() !== null });
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!blocked) return;
    // La lecture s'arrête : le PiP se ferme, et le lecteur ne reprendra pas à la réouverture.
    endPipSession();
    if (pathname.startsWith("/watch")) navigate("/", { replace: true });
  }, [blocked, pathname, navigate]);

  return blocked ? <AccountAccessPage blocked={blocked} /> : <>{children}</>;
}
