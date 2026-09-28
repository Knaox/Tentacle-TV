import { useEffect, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSeriesEpisodes } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { ActionCell } from "@/components/ActionCell";
import { useDeviceGroupState } from "@/hooks/offline/useDeviceState";
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
  /** Le gabarit de la grille de la feuille (largeur de colonne). */
  style?: StyleProp<ViewStyle>;
}

/**
 * L'extra « hors ligne » de la feuille d'appui long : « Garder hors ligne »
 * (film), « Garder l'épisode » (épisode), « Toute la série » (série) ; en
 * préparation ou sur l'appareil → l'écran « Sur cet appareil ». Une série
 * dont des épisodes sont déjà là le dit (le glyphe de la pastille), et garde
 * son dialogue pour en ajouter : elle n'est jamais « complète ».
 */
export function KeepOfflineActionCell({ item, onClose, style }: Props) {
  const { t } = useTranslation(["offline", "cards"]);
  const { colors } = useTheme();
  const router = useRouter();
  const isSeries = item.Type === "Series";
  const entry = useKeepOfflineEntry(isSeries ? undefined : item);
  const { canKeep } = useOfflineVisibility();
  // L'index de la liste partagée : une `Map` par version, pas un parcours.
  const group = useDeviceGroupState(isSeries ? item.Id : undefined);
  const [wanted, setWanted] = useState(false);
  const { data: episodes, isError } = useSeriesEpisodes(item.Id, { enabled: isSeries && wanted });

  const seriesActive = isSeries && group.active > 0;
  const seriesKept = isSeries && group.kept > 0;

  useEffect(() => {
    if (!wanted) return;
    if (isError) { setWanted(false); return; }
    if (!episodes) return;
    setWanted(false);
    onClose();
    openKeepOffline({ mode: "series", items: episodes, seriesId: item.Id, title: item.Name });
  }, [wanted, episodes, isError, item.Id, item.Name, onClose]);

  if (isSeries ? !canKeep && !seriesActive && !seriesKept : !entry.visible) return null;

  const state = isSeries ? (seriesActive ? "active" : seriesKept ? "complete" : "idle") : entry.state;
  const label = isSeries
    ? seriesActive ? t("stateInProgress") : seriesKept ? t("cards:status.onDeviceSome") : t("keepSeriesOffline")
    : entry.label;

  const onPress = (): void => {
    // Une série en partie gardée rouvre son dialogue : il reste des saisons.
    if (state === "active" || (state === "complete" && !isSeries)) {
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
      activeColor={colors.statusPairs.success.fg}
      onPress={onPress}
      style={style}
      ring={<View style={{ marginBottom: 10 }}><KeepOfflineGlyph state={state} size={60} iconSize={26} /></View>}
    />
  );
}
