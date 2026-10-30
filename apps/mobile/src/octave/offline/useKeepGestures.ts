/**
 * Octave (mobile) — les gestes « Garder hors ligne » et « Retirer de cet
 * appareil », et ce qu'ils disent (un message bref, jamais une fenêtre) :
 * combien de titres partent, ce qui ne peut pas être gardé, la place qui manque.
 * Les mêmes que le bureau (`keepActions`, `canKeepTrack`), le vocabulaire du
 * hors ligne (`musicOffline`).
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { musicRouteUrl } from "@tentacle-tv/api-client";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { canKeepTrack, externalKeepPath, type KeepCollection } from "@tentacle-tv/offline-core/music";
import { isTrackUnavailable } from "@tentacle-tv/shared/octave";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { showToast } from "@/notices/toastStore";
import { formatBytes } from "@/offline/formatBytes";
import { haptic } from "@/utils/haptics";
import { keepActions } from "./keptMusic";
import { useMusicOfflineContext } from "./musicOfflineContext";

export interface KeepGestures {
  keep: (tracks: readonly MusicTrack[], collection?: KeepCollection | null) => Promise<void>;
  remove: (kept: readonly KeptMusicTrack[], collectionKey?: string | null) => Promise<void>;
}

export function useKeepGestures(): KeepGestures {
  const { t } = useTranslation("musicOffline");
  const { surface, provider } = useMusicOfflineContext();

  const keep = useCallback(
    async (tracks: readonly MusicTrack[], collection: KeepCollection | null = null) => {
      // Ce que l'interface sait refuser d'avance (un titre d'ailleurs sans le droit de l'extension) ne part pas.
      const keepable = tracks.filter((track) => canKeepTrack(track, surface));
      const outcome = keepable.length === 0 ? ({ kind: "failed" } as const) : await keepActions.keepTracks(keepable, externalKeepPath(provider, musicRouteUrl), collection);
      if (outcome.kind === "noSpace") return void showToast({ title: t("noSpace", { needed: formatBytes(outcome.neededBytes) }) });
      if (outcome.kind === "failed") return void showToast({ title: t("failedAll") });
      haptic("commit");
      // Un titre indisponible n'est jamais tenté (`keepRules.ts`) : ce n'est pas un refus à dire.
      const refused = outcome.refused + tracks.filter((track) => !isTrackUnavailable(track) && !canKeepTrack(track, surface)).length;
      showToast({ tone: "success", title: t("queued", { count: outcome.count }), ...(refused > 0 ? { text: t("refusedSome", { count: refused }) } : {}) });
    },
    [provider, surface, t],
  );

  const remove = useCallback(
    async (kept: readonly KeptMusicTrack[], collectionKey: string | null = null) => {
      if (await keepActions.removeKept(kept, collectionKey)) {
        haptic("destructive");
        showToast({ tone: "success", title: t("removed") });
      } else showToast({ title: t("failedAll") });
    },
    [t],
  );

  return { keep, remove };
}
