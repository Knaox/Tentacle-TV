/**
 * Octave — l'INTENTION sur une carte d'album ou d'artiste hors bibliothèque :
 * survolée `INTENT_MS` (ou focalisée au clavier), sa page est demandée
 * d'avance, dans le MÊME cache que la vue (`useEntityQueries.ts` : clé
 * `["music", "external", kind, idOrKey]`, même réponse) — le clic l'ouvre
 * d'emblée. Rien ne s'affiche, une erreur ne se voit pas (la vue redemandera).
 * Plafond `MAX_PER_MINUTE` demandes ; une page déjà là ne repart pas.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchExternalAlbum, fetchExternalArtist } from "@tentacle-tv/api-client";
import { parseTrackKey } from "@tentacle-tv/shared/music";
import { isFromProvider, useOctaveProvider } from "../mode/useOctaveProvider";

export const INTENT_MS = 150;
export const MAX_PER_MINUTE = 20;
/** Celle de la vue : une page demandée d'avance reste fraîche jusqu'au clic. */
const STALE_MS = 60_000;

const recent: number[] = [];

/** Une demande d'avance de plus est-elle permise maintenant ? (fenêtre glissante d'une minute) */
export function takeIntentSlot(now = Date.now()): boolean {
  while (recent.length > 0 && now - recent[0] >= 60_000) recent.shift();
  if (recent.length >= MAX_PER_MINUTE) return false;
  recent.push(now);
  return true;
}

/** Pour les tests. */
export function resetIntentSlotsForTests(): void {
  recent.length = 0;
}

export interface IntentHandlers {
  onPointerEnter(): void;
  onPointerLeave(): void;
  onFocus(): void;
}

const NONE: IntentHandlers = { onPointerEnter: () => undefined, onPointerLeave: () => undefined, onFocus: () => undefined };

/** Les gestes d'intention d'une carte ; inertes pour la bibliothèque, ou sans l'extension qui l'a donnée. */
export function useEntityIntent(kind: "album" | "artist", idOrKey: string | null): IntentHandlers {
  const qc = useQueryClient();
  const provider = useOctaveProvider();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parsed = idOrKey?.startsWith("ext:") ? parseTrackKey(idOrKey) : null;
  const ref = parsed?.kind === "external" ? parsed.ref : null;
  const usable = ref !== null && isFromProvider(provider, ref.pluginId);

  const fire = useCallback(() => {
    if (!usable || !ref || !idOrKey || !provider) return;
    const queryKey = ["music", "external", kind, idOrKey];
    const state = qc.getQueryState(queryKey);
    if (state?.data !== undefined && Date.now() - state.dataUpdatedAt < STALE_MS) return;
    if (state?.fetchStatus === "fetching" || !takeIntentSlot()) return;
    const queryFn = ({ signal }: { signal: AbortSignal }): Promise<unknown> =>
      kind === "album" ? fetchExternalAlbum(provider, ref.id, signal) : fetchExternalArtist(provider, ref.id, signal);
    void qc.prefetchQuery({ queryKey, queryFn, staleTime: STALE_MS, retry: false });
  }, [usable, ref, idOrKey, provider, kind, qc]);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  return useMemo(
    () =>
      usable
        ? {
            onPointerEnter: () => {
              cancel();
              timer.current = setTimeout(fire, INTENT_MS);
            },
            onPointerLeave: cancel,
            onFocus: fire,
          }
        : NONE,
    [usable, fire, cancel],
  );
}
