import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useResolvePlayTarget } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * « Lire » depuis Ma liste : un film part tout de suite, une série résout son
 * épisode au geste (`useResolvePlayTarget`). Sans rien à lire — série
 * terminée, épisodes introuvables — la fiche s'ouvre : c'est elle qui sait
 * proposer une relecture.
 *
 * `pendingId` laisse le bouton touché montrer qu'il travaille pendant la
 * résolution, qui peut prendre une requête.
 */
export function usePlayFromWatchlist() {
  const navigate = useNavigate();
  const resolve = useResolvePlayTarget();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const play = useCallback(
    async (item: MediaItem) => {
      setPendingId(item.Id);
      try {
        const target = await resolve(item);
        navigate(target ? `/watch/${target}` : `/media/${item.Id}`);
      } finally {
        setPendingId(null);
      }
    },
    [navigate, resolve],
  );

  return { play, pendingId };
}

/**
 * Le dernier titre retiré d'un geste, gardé le temps de proposer « Annuler ».
 * Un seul à la fois : un second retrait remplace le premier, dont l'annulation
 * n'a plus de sens une fois l'attention passée ailleurs.
 */
export function useRemovalUndo() {
  const [removed, setRemoved] = useState<MediaItem | null>(null);
  const clear = useCallback(() => setRemoved(null), []);
  return { removed, onRemoved: setRemoved, clear };
}
