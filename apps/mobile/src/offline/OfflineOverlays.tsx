import { ConnectivityNoticeBanner } from "./ConnectivityNoticeBanner";

/**
 * Ce que l'application montre quand elle bascule hors ligne : plus de voile
 * plein écran, quelle que soit la cause (retour de Damien, 2026-10-06) —
 * l'application passe sur le catalogue de l'appareil (`useOfflineMode`), et
 * un message temporaire dit pourquoi. Nécessite AppProviders.
 */
export function OfflineOverlays() {
  return <ConnectivityNoticeBanner />;
}
