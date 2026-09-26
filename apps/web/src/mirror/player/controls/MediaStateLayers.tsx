import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { MirrorPlayerLoadingScreen } from "../loading/MirrorPlayerLoadingScreen";
import type { MirrorPlayerMedia } from "../types";

const LOADING_FADE_MS = 280;

/**
 * Les couches d'ÉTAT du moteur web sous l'habillage : l'écran de chargement de
 * l'app jusqu'à la première image (puis son fondu de 280 ms), le témoin de
 * mise en mémoire tampon en cours de lecture, et « Appuyer pour lire » quand
 * le navigateur refuse la lecture automatique.
 *
 * Les deux derniers n'existent pas dans l'app — ils répondent au moteur WEB :
 * un saut HLS renégocie la session (l'image se fige le temps du rechargement),
 * et un navigateur mobile peut bloquer la lecture sans geste de l'utilisateur.
 */
export function MediaStateLayers({ media, item, onBack }: {
  media: MirrorPlayerMedia;
  item?: MediaItem;
  onBack: () => void;
}) {
  const { t } = useTranslation("player");
  const { hasStarted, loading, showPlayButton, setShowPlayButton, videoRef, userInteractedRef } = media;
  const [loadingMounted, setLoadingMounted] = useState(!hasStarted);

  useEffect(() => {
    if (!hasStarted) { setLoadingMounted(true); return; }
    const timer = setTimeout(() => setLoadingMounted(false), LOADING_FADE_MS);
    return () => clearTimeout(timer);
  }, [hasStarted]);

  return (
    <>
      {loadingMounted && !showPlayButton && (
        <MirrorPlayerLoadingScreen item={item} onCancel={onBack} leaving={hasStarted} />
      )}

      {hasStarted && loading && !showPlayButton && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      {showPlayButton && (
        <button
          type="button"
          className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            e.stopPropagation();
            userInteractedRef.current = true;
            const video = videoRef.current;
            if (video) video.play().then(() => setShowPlayButton(false)).catch(() => {});
          }}
        >
          <span className="flex flex-col items-center gap-3">
            <svg className="h-20 w-20 text-white/90" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
            <span className="text-sm text-white/70">{t("pressToPlay")}</span>
          </span>
        </button>
      )}
    </>
  );
}
