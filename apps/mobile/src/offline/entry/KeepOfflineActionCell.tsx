import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSeriesEpisodes, useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { ActionCell } from "@/components/ActionCell";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { useOfflineVisibility } from "@/hooks/offline/useOfflineVisibility";
import { useTheme } from "@/theme";
import { openKeepOffline } from "../keep/keepOfflineStore";
import { KeepOfflineGlyph } from "./KeepOfflineGlyph";
import { useKeepOfflineEntry } from "./useKeepOfflineEntry";

interface Props {
  /** Le titre APPUYÉ (film, épisode ou série) — un épisode vise l'épisode, pas la série. */
  item: MediaItem;
  /** Ferme la feuille d'appui long avant d'ouvrir le dialogue (iOS : une modale à la fois). */
  onClose: () => void;
}

/**
 * La quatrième cellule de la feuille d'appui long : « Garder hors ligne »
 * (film), « Garder l'épisode » (épisode), « Toute la série » (série) ; en
 * préparation ou sur l'appareil → l'écran « Sur cet appareil ».
 */
export function KeepOfflineActionCell({ item, onClose }: Props) {
  const { t } = useTranslation("offline");
  const { colors } = useTheme();
  const router = useRouter();
  const userId = useUserId();
  const isSeries = item.Type === "Series";
  const entry = useKeepOfflineEntry(isSeries ? undefined : item);
  const { canKeep } = useOfflineVisibility();
  const { data: entries } = useOfflineList(userId);
  const [wanted, setWanted] = useState(false);
  const { data: episodes, isError } = useSeriesEpisodes(item.Id, { enabled: isSeries && wanted });

  const seriesActive = isSeries && (entries ?? []).some(
    (e) => e.seriesId === item.Id && (e.status === "queued" || e.status === "downloading" || e.status === "paused"),
  );

  useEffect(() => {
    if (!wanted) return;
    if (isError) { setWanted(false); return; }
    if (!episodes) return;
    setWanted(false);
    onClose();
    openKeepOffline({ mode: "series", items: episodes, seriesId: item.Id, title: item.Name });
  }, [wanted, episodes, isError, item.Id, item.Name, onClose]);

  if (isSeries ? !canKeep && !seriesActive : !entry.visible) return null;

  const state = isSeries ? (seriesActive ? "active" : "idle") : entry.state;
  const label = isSeries ? (seriesActive ? t("stateInProgress") : t("keepSeriesOffline")) : entry.label;

  const onPress = (): void => {
    if (state !== "idle") {
      onClose();
      router.push("/on-device");
      return;
    }
    if (isSeries) {
      setWanted(true);
      return;
    }
    onClose();
    openKeepOffline({ mode: "single", items: [item], title: item.Name });
  };

  return (
    <ActionCell
      icon="download"
      label={label}
      active={state === "complete"}
      activeColor={colors.brand.violet}
      onPress={onPress}
      ring={<View style={{ marginBottom: 10 }}><KeepOfflineGlyph state={state} size={60} iconSize={26} /></View>}
    />
  );
}
