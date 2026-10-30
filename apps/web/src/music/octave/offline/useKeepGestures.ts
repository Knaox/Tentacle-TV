/**
 * Octave — les gestes « Garder hors ligne » et « Retirer de cet appareil », et
 * ce qu'ils disent (un avis bref, jamais une fenêtre) : combien de titres
 * partent, ce qui ne peut pas être gardé, la place qui manque.
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { useToast } from "../../../contexts/ToastContext";
import { formatBytes } from "../../../downloads/presets";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { canKeepTrack } from "@tentacle-tv/offline-core/music";
import { isTrackUnavailable } from "@tentacle-tv/shared/octave";
import { keepTracks, removeKept, type KeepCollection } from "./keepMusic";
import { useOfflineSurface } from "./offlineSurfaceContext";

export interface KeepGestures {
  keep: (tracks: readonly MusicTrack[], collection?: KeepCollection | null) => Promise<void>;
  remove: (kept: readonly KeptMusicTrack[], collectionKey?: string | null) => Promise<void>;
}

export function useKeepGestures(): KeepGestures {
  const { t } = useTranslation("musicOffline");
  const toast = useToast();
  const provider = useOctaveProvider();
  const surface = useOfflineSurface();

  const keep = useCallback(
    async (tracks: readonly MusicTrack[], collection: KeepCollection | null = null) => {
      // Ce que l'interface sait refuser d'avance (un titre d'ailleurs sans le droit de l'extension) ne part pas.
      const keepable = tracks.filter((track) => canKeepTrack(track, surface));
      const outcome = keepable.length === 0 ? ({ kind: "failed" } as const) : await keepTracks(keepable, provider, collection);
      if (outcome.kind === "noSpace") return void toast.show("error", t("noSpace", { needed: formatBytes(outcome.neededBytes) }));
      if (outcome.kind === "failed") return void toast.show("error", t("failedAll"));
      // Un titre indisponible n'est jamais tenté (`keepRules.ts`) : ce n'est pas un refus à dire.
      const refused = outcome.refused + tracks.filter((track) => !isTrackUnavailable(track) && !canKeepTrack(track, surface)).length;
      toast.show("success", refused > 0 ? `${t("queued", { count: outcome.count })} · ${t("refusedSome", { count: refused })}` : t("queued", { count: outcome.count }));
    },
    [provider, surface, t, toast],
  );

  const remove = useCallback(
    async (kept: readonly KeptMusicTrack[], collectionKey: string | null = null) => {
      if (await removeKept(kept, collectionKey)) toast.show("success", t("removed"));
      else toast.show("error", t("failedAll"));
    },
    [t, toast],
  );

  return { keep, remove };
}
