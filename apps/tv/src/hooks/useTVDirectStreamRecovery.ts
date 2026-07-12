import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { fetchStreamingConfig, useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";

/** Erreur HTTP d'auth remontée par ExoPlayerView (` http=401` / ` http=403`). */
const HTTP_AUTH_ERROR = /\bhttp=40[13]\b/;
/** Deux échecs d'auth dans cette fenêtre = le token re-demandé ne marche pas
 *  non plus → message explicite plutôt qu'une boucle de reload. */
const RETRY_WINDOW_MS = 30_000;

/**
 * Récupération d'un 401/403 sur le STREAM en direct streaming : le token
 * Jellyfin de l'appareil est mort/révoqué. On redemande un token frais au
 * backend (`/api/config/streaming`, self-healing côté serveur depuis un
 * appareil frère du même compte) puis on recharge la lecture en DIRECT à la
 * même position. JAMAIS de bascule proxy silencieuse : si aucun token frais
 * n'existe, une erreur explicite invite à reconfirmer le jumelage.
 */
export function useTVDirectStreamRecovery(args: {
  /** Fige la position courante comme point de reprise du flux rechargé. */
  captureReloadTicks: () => void;
  /** Force la reconstruction de l'URL de stream (token frais inclus). */
  bumpReloadNonce?: () => void;
  setVideoError: (e: string | null) => void;
  setIsLoading?: (v: boolean) => void;
}) {
  const { captureReloadTicks, bumpReloadNonce, setVideoError, setIsLoading } = args;
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const { t } = useTranslation("player");
  const lastAttemptRef = useRef(0);
  const busyRef = useRef(false);

  /** @return true si l'erreur est prise en charge (récupération lancée ou message posé). */
  const tryDirectAuthRecovery = useCallback((error: string): boolean => {
    if (!bumpReloadNonce) return false;
    if (!client.getDirectStreaming()) return false; // proxy → pas un problème de token direct
    if (!HTTP_AUTH_ERROR.test(error)) return false;
    if (busyRef.current) return true;               // récupération en cours → absorber l'écho
    if (Date.now() - lastAttemptRef.current < RETRY_WINDOW_MS) {
      setVideoError(t("directSessionExpired"));
      return true;
    }
    lastAttemptRef.current = Date.now();
    busyRef.current = true;
    void (async () => {
      try {
        captureReloadTicks();                       // reprise à la position courante
        setIsLoading?.(true);
        const prev = client.getDirectStreaming()?.jellyfinToken ?? null;
        const cfg = await fetchStreamingConfig(storage.getItem("tentacle_token"));
        if (cfg.enabled && cfg.mediaBaseUrl && cfg.jellyfinToken && cfg.jellyfinToken !== prev) {
          client.setDirectStreaming({
            enabled: true, mediaBaseUrl: cfg.mediaBaseUrl, jellyfinToken: cfg.jellyfinToken,
          });
          bumpReloadNonce();                        // URL reconstruite → reload avec le token frais
          return;
        }
        // Pas de token de remplacement (session Jellyfin morte côté serveur,
        // direct désactivé, ou backend injoignable) → erreur actionnable.
        setVideoError(t("directSessionExpired"));
      } catch {
        setVideoError(t("directSessionExpired"));
      } finally {
        busyRef.current = false;
      }
    })();
    return true;
  }, [client, storage, captureReloadTicks, bumpReloadNonce, setVideoError, setIsLoading, t]);

  return { tryDirectAuthRecovery };
}
