import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Le retour des écrans empilés (`utils/backOrHome` de l'app) : l'écran
 * précédent s'il y en a un dans cet onglet du navigateur, sinon l'accueil —
 * un lien ouvert directement ne renvoie jamais hors de l'application.
 */
export function useBackOrHome(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate]);
}
