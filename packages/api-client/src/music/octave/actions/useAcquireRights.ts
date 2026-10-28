/**
 * Octave — les droits d'ajout du compte, lus une fois pour tout Octave (React Query, `musicRightsKey`) : la garde
 * des boutons d'ajout, le reste du jour dit après un ajout, le refus de limite dit en mots simples. Relus après
 * chaque ajout, au retour sur la fenêtre et à minuit (heure du serveur, `resetsAt`). Extension d'avant : tout
 * comme avant (`MUSIC_RIGHTS_BEFORE`). L'extension et les mots viennent de l'application (web, mobile).
 */

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MUSIC_RIGHTS_BEFORE, type ExternalActionRefusal, type MusicRights } from "@tentacle-tv/shared/music";
import type { MusicProvider } from "../../../pluginMusic/musicProvider";
import { afterOneAcquired, fetchMusicRights, musicRightsKey } from "../../../pluginMusic/musicRights";
import { mayOfferAcquire, quotaExhausted, remainingToTell } from "./acquireRules";
import type { MusicTranslate } from "./actionsUi";

export interface AcquireRights {
  rights: MusicRights;
  /** Le bouton d'ajout d'un titre hors bibliothèque existe-t-il ? */
  canAcquire: boolean;
  /** Plus rien aujourd'hui : le geste se refuse tout de suite. */
  exhausted: boolean;
  /** Le refus en mots simples (titre, message) ; la limite du jour dit son nombre. */
  refusal: (reason: ExternalActionRefusal) => { title: string; message: string };
  /** Un ajout accepté : le reste se décompte, et sa phrase si l'on approche de la limite (« Plus que 2 ajouts… »). */
  acquired: () => string | null;
  /** Un refus de limite (ou de droit) : les droits se relisent. */
  refresh: () => void;
}

const MAX_TIMER_MS = 24 * 3600_000;

export function useAcquireRights(provider: MusicProvider | null, t: MusicTranslate): AcquireRights {
  const qc = useQueryClient();
  const pluginId = provider?.pluginId ?? null;
  const key = useMemo(() => musicRightsKey(pluginId), [pluginId]);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => (provider ? fetchMusicRights(provider, signal) : Promise.resolve(MUSIC_RIGHTS_BEFORE)),
    enabled: !!provider?.music.rights,
    staleTime: 60_000,
    retry: false,
  });
  const rights = query.data ?? MUSIC_RIGHTS_BEFORE;
  const refresh = useCallback(() => void qc.invalidateQueries({ queryKey: key }), [qc, key]);

  // Minuit (heure du serveur) : le compteur repart, les droits se relisent d'eux-mêmes.
  const resetsAt = rights.resetsAt;
  useEffect(() => {
    if (resetsAt === null) return;
    const wait = Math.min(MAX_TIMER_MS, Math.max(1_000, resetsAt - Date.now() + 1_000));
    const timer = setTimeout(refresh, wait);
    return () => clearTimeout(timer);
  }, [resetsAt, refresh]);

  const acquired = useCallback((): string | null => {
    const current = qc.getQueryData<MusicRights>(key);
    if (!current) return null;
    const next = afterOneAcquired(current);
    qc.setQueryData(key, next);
    refresh();
    const left = remainingToTell(next);
    return left === null ? null : t("rights.remaining", { count: left });
  }, [qc, key, refresh, t]);

  const refusal = useCallback(
    (reason: ExternalActionRefusal) => {
      if (reason === "quota" || reason === "forbidden") refresh();
      if (reason === "quota" && rights.dailyLimit > 0) {
        return { title: t("rights.quotaTitle"), message: t("rights.quotaReached", { count: rights.dailyLimit }) };
      }
      return { title: t("refusal.title"), message: t(`refusal.${reason}`) };
    },
    [refresh, rights.dailyLimit, t],
  );

  return useMemo(
    () => ({ rights, canAcquire: mayOfferAcquire(rights), exhausted: quotaExhausted(rights), refusal, acquired, refresh }),
    [rights, refusal, acquired, refresh],
  );
}
