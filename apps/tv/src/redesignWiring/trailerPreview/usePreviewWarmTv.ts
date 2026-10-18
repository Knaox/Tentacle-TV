import { useEffect, useMemo, useRef } from "react";
import { Image } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchTrailerPreviewWarm, seedTrailerPreviews, trailerPreviewSettled, useServerCapability } from "@tentacle-tv/api-client";
import { uiLanguage, type TrailerPreviewSubject } from "@tentacle-tv/shared";
import { createPreviewWarmQueue, type PreviewWarmWant } from "@tentacle-tv/tv-core";
import type { CardModel } from "../../redesign/cards/cardTypes";
import type { CardPreviewWarm } from "../../redesign/cards/trailerPreviewPort";
import { useTrailerPreviewsEnabled } from "../../lib/trailerPreviewSettings";
import { useAppActive } from "./previewDevice";

/** La file de l'appareil : un titre préparé le reste d'une page à l'autre. */
const queue = createPreviewWarmQueue();

/** Les fonds déjà demandés au cache d'images (les plus anciens s'oublient). */
const prefetched = new Set<string>();
const PREFETCH_MEMORY = 240;

/**
 * Le FOND de la zone d'aperçu des cartes autour du focus, mis d'avance dans le
 * cache d'images : au focus, la zone le montre aussitôt. Toujours, même
 * aperçus coupés (le fond se montre sans eux).
 */
function prefetchBackdrops(cards: readonly CardModel[]): void {
  for (const card of cards) {
    const uri = card.billboard?.backdropUri ?? card.landscapeUri;
    if (!uri || prefetched.has(uri)) continue;
    prefetched.add(uri);
    if (prefetched.size > PREFETCH_MEMORY) prefetched.delete(prefetched.values().next().value as string);
    Image.prefetch(uri).catch(() => prefetched.delete(uri));
  }
}

/**
 * La PRÉPARATION des aperçus autour du focus (tv-core `createPreviewWarmQueue`)
 * — branchée quand elle est permise : le serveur la sait faire
 * (`trailers.previewWarm`), les aperçus sont allumés, l'app est à l'écran.
 * Les aperçus prêts entrent dans le cache des aperçus (`seedTrailerPreviews`) :
 * le focus d'un titre préparé n'a plus rien à demander, sa vidéo part à
 * l'intention. Le fond des mêmes cartes se précharge toujours
 * (`prefetchBackdrops`).
 */
export function useTvPreviewWarm(): CardPreviewWarm {
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
    if (!on) return prefetchBackdrops;
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
    return (cards: readonly CardModel[], options?: PreviewWarmWant) => {
      prefetchBackdrops(cards);
      const subjects = cards.flatMap((card) => (card.trailer ? [card.trailer] : []));
      if (subjects.length === 0 && !options?.replace) return;
      queue.want(subjects, Date.now(), options);
      schedule();
    };
  }, [on, lang, queryClient]);
}
