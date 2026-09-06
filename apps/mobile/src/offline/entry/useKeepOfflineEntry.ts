import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { useItemOfflineState } from "@/hooks/offline/useOfflineList";
import { useOfflineVisibility } from "@/hooks/offline/useOfflineVisibility";
import { openKeepOffline } from "../keep/keepOfflineStore";
import type { KeepOfflineState } from "./KeepOfflineGlyph";

export interface KeepOfflineEntry {
  /** Rendre le bouton ? (droit de garder, ou un état existant pour ce titre) */
  visible: boolean;
  state: KeepOfflineState;
  label: string;
  /** Idle → dialogue ; sinon → l'écran « Sur cet appareil ». */
  onPress: () => void;
}

/** Ce qu'un point d'entrée (fiche, ligne d'épisode) a besoin de savoir pour un titre. */
export function useKeepOfflineEntry(item: MediaItem | undefined): KeepOfflineEntry {
  const { t } = useTranslation("offline");
  const router = useRouter();
  const { canKeep } = useOfflineVisibility();
  const { data: entry } = useItemOfflineState(item?.Id);

  const status = entry?.status ?? null;
  const state: KeepOfflineState =
    status === "complete" ? "complete"
      : status === "queued" || status === "downloading" || status === "paused" ? "active"
        : "idle";
  // Au repos, un épisode dit « Garder l'épisode » : la fiche d'un épisode ne
  // garde que lui — « Toute la série » n'existe que sur la fiche de la série.
  const idleLabel = item?.Type === "Episode" ? t("keepEpisodeOffline") : t("keepOffline");
  const label = state === "complete" ? t("stateOnDevice") : state === "active" ? t("stateInProgress") : idleLabel;

  const onPress = useCallback(() => {
    if (!item) return;
    if (state === "idle") openKeepOffline({ mode: "single", items: [item], title: item.Name });
    else router.push("/on-device");
  }, [item, state, router]);

  return { visible: item !== undefined && (canKeep || status !== null), state, label, onPress };
}
