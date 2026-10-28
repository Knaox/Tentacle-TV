/**
 * Octave — l'INTENTION sur une carte d'album ou d'artiste hors bibliothèque :
 * survolée `INTENT_MS` (ou focalisée au clavier), ou appui commencé (le doigt,
 * le bouton de la souris : le clic arrive), sa page est demandée d'avance,
 * dans le MÊME cache que la vue (`prefetchExternalEntity` d'api-client, la
 * même que le mobile) — le clic l'ouvre d'emblée. Rien ne s'affiche, une
 * erreur ne se voit pas (la vue redemandera). Plafond : `INTENT_PER_MINUTE`.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { externalEntityRef, prefetchExternalEntity } from "@tentacle-tv/api-client";
import { isFromProvider, useOctaveProvider } from "../mode/useOctaveProvider";

export const INTENT_MS = 150;

export interface IntentHandlers {
  onPointerEnter(): void;
  onPointerLeave(): void;
  onPointerDown(): void;
  onFocus(): void;
}

const NONE: IntentHandlers = { onPointerEnter: () => undefined, onPointerLeave: () => undefined, onPointerDown: () => undefined, onFocus: () => undefined };

/** Les gestes d'intention d'une carte ; inertes pour la bibliothèque, ou sans l'extension qui l'a donnée. */
export function useEntityIntent(kind: "album" | "artist", idOrKey: string | null): IntentHandlers {
  const qc = useQueryClient();
  const provider = useOctaveProvider();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usable = isFromProvider(provider, externalEntityRef(idOrKey)?.pluginId);

  const fire = useCallback(() => {
    if (usable) prefetchExternalEntity(qc, provider, kind, idOrKey);
  }, [usable, qc, provider, kind, idOrKey]);

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
            onPointerDown: () => {
              cancel();
              fire();
            },
            onFocus: fire,
          }
        : NONE,
    [usable, fire, cancel],
  );
}
