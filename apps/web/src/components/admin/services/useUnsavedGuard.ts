import { useEffect } from "react";
import { isDesktopApp } from "../../../desktop/bridge";

/**
 * Fermer l'onglet ou recharger la page avec une modification en attente :
 * le navigateur demande confirmation.
 *
 * Jamais dans l'application de bureau : sous Electron, un `beforeunload`
 * annulé n'affiche AUCUNE question — il empêche la fenêtre de se fermer, en
 * silence. Un champ modifié y bloquerait la sortie de l'application.
 */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty || isDesktopApp()) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Encore exigé par les navigateurs qui ignorent `preventDefault()` ici.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
