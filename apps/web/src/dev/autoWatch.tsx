import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Auto-lecture au démarrage — **dev uniquement**.
 *
 * Pour itérer sur le lecteur desktop (fantômes WebKitGTK sous Linux, rendu mpv
 * et HDR sous macOS) sans cliquer à chaque relance : mémorise le dernier
 * `/watch/:itemId` visité, puis, si l'app démarre avec `?autowatch=` dans l'URL,
 * re-navigue automatiquement vers cette lecture ~1 s après l'arrivée sur
 * l'accueil.
 *
 * Le paramètre accepte un identifiant : `?autowatch=<itemId>` vise CE média,
 * `?autowatch=1` reprend le dernier visité. Viser explicitement est ce qui rend
 * la boucle reproductible — le HDR ne se juge que sur un titre dont on sait
 * qu'il en a (cf. `TENTACLE_AUTOWATCH` côté coquille Electron).
 *
 * Aucun effet dans un build livré (montage conditionnel dans App.tsx) ni sans
 * le paramètre `autowatch`.
 */
export function AutoWatchHarness() {
  const location = useLocation();
  const navigate = useNavigate();

  // Mémorise le dernier watch visité.
  useEffect(() => {
    const m = location.pathname.match(/^\/watch\/([^/]+)$/);
    if (m) {
      try { localStorage.setItem("tentacle_dev_last_watch", m[1]); } catch { /* no-op */ }
    }
  }, [location.pathname]);

  // Au boot sur l'accueil avec ?autowatch → lance la lecture visée, ou la
  // dernière. `1` est la valeur historique et ne désigne aucun média.
  useEffect(() => {
    const demande = new URLSearchParams(window.location.search).get("autowatch");
    if (demande === null) return;
    if (location.pathname !== "/") return;
    const id = demande === "" || demande === "1"
      ? localStorage.getItem("tentacle_dev_last_watch")
      : demande;
    if (!id) return;
    const t = setTimeout(() => {
      console.info(`[autowatch] reprise automatique de /watch/${id}`);
      navigate(`/watch/${id}`);
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}
