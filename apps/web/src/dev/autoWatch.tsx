import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Auto-lecture au démarrage — **dev uniquement**.
 *
 * Pour itérer sur le lecteur desktop Linux (fantômes WebKitGTK, rendu mpv) sans
 * cliquer à chaque relance : mémorise le dernier `/watch/:itemId` visité, puis,
 * si l'app démarre avec `?autowatch=1` dans l'URL (cf. `devUrl` de
 * `tauri.linux.conf.json` pendant les sessions de debug), re-navigue
 * automatiquement vers cette lecture ~1 s après l'arrivée sur l'accueil.
 *
 * Aucun effet en production (`import.meta.env.DEV` + montage conditionnel dans
 * App.tsx) ni sans le paramètre `autowatch`.
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

  // Au boot sur l'accueil avec ?autowatch=1 → relance la dernière lecture.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("autowatch")) return;
    if (location.pathname !== "/") return;
    const id = localStorage.getItem("tentacle_dev_last_watch");
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
