/**
 * Octave — le crochet du préchargement des albums VUS DÉFILER (`entityWarmup.ts`), sans DOM : chaque liste dit
 * ce qu'elle montre (`visible`) et quand elle bouge (`moving`) ; rien ne part tant qu'elle n'est pas restée
 * immobile `WARM_SETTLE_MS` — jamais pendant une rafale, jamais pour une liste démontée.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WARM_SETTLE_MS } from "@tentacle-tv/shared/octave";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import type { MusicProvider } from "../../pluginMusic/musicProvider";
import { warmModeOf, warmVisibleAlbums } from "./entityWarmup";

export interface AlbumWarmup {
  /** Les albums affichés maintenant ; le signal part à l'arrêt. */
  visible(albums: readonly MusicAlbum[]): void;
  /** La liste défile : l'arrêt se compte à partir de maintenant. */
  moving(): void;
}

const NONE: AlbumWarmup = { visible: () => undefined, moving: () => undefined };

export function useAlbumWarmup(provider: MusicProvider | null): AlbumWarmup {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = useRef<readonly MusicAlbum[]>([]);
  const active = warmModeOf(provider) !== null;

  const arm = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      warmVisibleAlbums(qc, provider, shown.current);
    }, WARM_SETTLE_MS);
  }, [qc, provider]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  return useMemo(
    () =>
      active
        ? {
            visible: (albums: readonly MusicAlbum[]) => {
              shown.current = albums;
              arm();
            },
            moving: () => {
              if (timer.current !== null) arm();
            },
          }
        : NONE,
    [active, arm],
  );
}
