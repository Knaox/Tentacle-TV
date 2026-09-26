import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * `backOrHome` de l'app : retour s'il y a de l'historique DANS l'app, sinon
 * l'accueil (lien ouvert directement, onglet neuf). React Router numérote ses
 * entrées dans `history.state.idx` : 0 = première page de la session.
 */
export function canGoBack(state: unknown): boolean {
  if (!state || typeof state !== "object") return false;
  const idx = (state as { idx?: unknown }).idx;
  return typeof idx === "number" && idx > 0;
}

export function useBackOrHome(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (canGoBack(window.history.state)) navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate]);
}
