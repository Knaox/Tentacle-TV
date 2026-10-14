import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchTrailerPreviewWarm, seedTrailerPreviews, trailerPreviewSettled, useServerCapability } from "@tentacle-tv/api-client";
import { uiLanguage } from "@tentacle-tv/shared";
import { usePipSession } from "../pictureInPicture/pictureInPictureStore";
import { useTrailerPreviewBlock } from "./previewEnvironment";
import { loadPreviewHls } from "./previewSource";
import { setPreviewWarmSender } from "./previewWarm";

/** Le lecteur des aperçus se charge quand la page a fini les siennes : deux secondes, puis un temps mort. */
const HLS_PRELOAD_DELAY_MS = 2_000;

/** Après `delayMs`, au premier temps mort (Safari n'a pas `requestIdleCallback` : tout de suite). Rend l'annulation. */
function whenIdle(task: () => void, delayMs: number): () => void {
  let idle: number | null = null;
  const timer = window.setTimeout(() => {
    if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(task, { timeout: 3_000 });
    else task();
  }, delayMs);
  return () => {
    window.clearTimeout(timer);
    if (idle !== null) window.cancelIdleCallback(idle);
  };
}

/**
 * Branche la PRÉPARATION des aperçus (`previewWarm.ts`) quand elle est permise :
 * le serveur la sait faire (`trailers.previewWarm`), rien n'interdit les
 * aperçus sur cet appareil (réglage, hors ligne, miroir, page cachée, pas de
 * souris, économie de données), aucune PiP en cours. Les titres visibles
 * partent au serveur ; les aperçus déjà prêts entrent dans le cache des
 * aperçus — leur survol n'a plus rien à demander. hls.js se charge d'avance :
 * le premier survol ne l'attend pas. Montée UNE fois, par la liaison racine.
 */
export function usePreviewWarm(): void {
  const capable = useServerCapability("trailers.previewWarm");
  const block = useTrailerPreviewBlock();
  const pip = usePipSession();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const lang = uiLanguage(i18n.language);
  const enabled = capable && block === null && pip === null;

  useEffect(() => {
    if (!enabled) return;
    const release = setPreviewWarmSender({
      send: async (subjects) => {
        const response = await fetchTrailerPreviewWarm(subjects, lang);
        if (response) seedTrailerPreviews(queryClient, response, lang);
        return response !== null;
      },
      isReady: (subject) => trailerPreviewSettled(queryClient, subject, lang),
    });
    const cancelPreload = whenIdle(() => void loadPreviewHls().catch(() => undefined), HLS_PRELOAD_DELAY_MS);
    return () => {
      release();
      cancelPreload();
    };
  }, [enabled, lang, queryClient]);
}
