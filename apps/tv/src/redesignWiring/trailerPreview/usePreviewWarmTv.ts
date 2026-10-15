import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchTrailerPreviewWarm, seedTrailerPreviews, trailerPreviewSettled, useServerCapability } from "@tentacle-tv/api-client";
import { uiLanguage, type TrailerPreviewSubject } from "@tentacle-tv/shared";
import { createPreviewWarmQueue } from "@tentacle-tv/tv-core";
import type { CardPreviewWarm } from "../../redesign/cards/trailerPreviewPort";
import { useTrailerPreviewsEnabled } from "../../lib/trailerPreviewSettings";
import { useAppActive } from "./previewDevice";

/** La file de l'appareil : un titre préparé le reste d'une page à l'autre. */
const queue = createPreviewWarmQueue();

/**
 * La PRÉPARATION des aperçus autour du focus (tv-core `createPreviewWarmQueue`)
 * — branchée quand elle est permise : le serveur la sait faire
 * (`trailers.previewWarm`), les aperçus sont allumés, l'app est à l'écran.
 * Les aperçus prêts entrent dans le cache des aperçus (`seedTrailerPreviews`) :
 * le focus d'un titre préparé n'a plus rien à demander, sa vidéo part à
 * l'intention. Rend `null` quand rien ne se prépare.
 */
export function useTvPreviewWarm(): CardPreviewWarm | null {
  const capable = useServerCapability("trailers.previewWarm");
  const enabled = useTrailerPreviewsEnabled();
  const active = useAppActive();
  // Une seule copie de react-query à l'exécution (singleton de `metro.config.js`) ;
  // les types de l'app (v4) et de l'api-client (v5) diffèrent seulement.
  const queryClient = useQueryClient() as unknown as Parameters<typeof seedTrailerPreviews>[0];
  const { i18n } = useTranslation();
  const lang = uiLanguage(i18n.language);
  const on = capable && enabled && active;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sending = useRef(false);
  const alive = useRef(on);
  alive.current = on;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, [on, lang]);

  return useMemo(() => {
    if (!on) return null;
    const isReady = (subject: TrailerPreviewSubject) => trailerPreviewSettled(queryClient, subject, lang);
    const schedule = () => {
      if (sending.current) return;
      const due = queue.dueAt(Date.now());
      if (due === null) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void flush();
      }, Math.max(0, due - Date.now()));
    };
    const flush = async () => {
      if (!alive.current) return;
      const batch = queue.take(Date.now(), isReady);
      if (batch.length > 0) {
        sending.current = true;
        const response = await fetchTrailerPreviewWarm(batch, lang);
        sending.current = false;
        if (response) seedTrailerPreviews(queryClient, response, lang);
        else queue.failed(Date.now());
      }
      if (alive.current) schedule();
    };
    return (subjects: readonly TrailerPreviewSubject[]) => {
      queue.want(subjects, Date.now());
      schedule();
    };
  }, [on, lang, queryClient]);
}
