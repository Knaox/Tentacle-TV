import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { qualityDropText, type QualityDrop, type QualityPreset, type SourceQuality } from "@tentacle-tv/shared";
import { TABLET_MIN_WIDTH } from "@/theme";
import { useChromeInsets } from "../../../player/chrome/useChromeInsets";
import { panelLayout } from "../../../player/panels/panelLayout";
import { playerMenuSections, type PlayerMenu } from "../../../player/panels/playerMenus";
import { qualityOptions, subtitleOptions, trackOption, type MenuSectionModel } from "../../../player/panels/menuOptions";
import { PlayerMenuPanel } from "./PlayerMenuPanel";

interface Track { index: number; label: string }

interface Props {
  /** Le menu ouvert ; `null` : aucun (rien n'est monté). */
  open: PlayerMenu | null;
  audioTracks: readonly Track[];
  subtitleTracks: readonly Track[];
  selectedAudio: number;
  selectedSubtitle: number;
  qualityKey: QualityPreset["key"];
  qualityPresets: readonly QualityPreset[];
  autoQualityActive?: boolean;
  qualityDrop?: QualityDrop | null;
  sourceQuality: SourceQuality;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  onSelectQuality: (key: QualityPreset["key"]) => void;
  onClose: () => void;
}

/**
 * Les deux menus du lecteur — « Audio et sous-titres » et « Réglages » —, leur
 * contenu tiré des règles pures (`playerMenus`, `menuOptions`) et leur place de
 * `panelLayout`. Un choix ferme le menu, comme avant.
 */
export function PlayerMenus(props: Props) {
  const { open, audioTracks, subtitleTracks, selectedAudio, selectedSubtitle, qualityKey, qualityPresets,
    autoQualityActive, qualityDrop, sourceQuality, onSelectAudio, onSelectSubtitle, onSelectQuality, onClose } = props;
  const { t, i18n } = useTranslation("player");
  const { width, height } = useWindowDimensions();
  const edges = useChromeInsets();

  const sections = useMemo<MenuSectionModel[]>(() => {
    if (!open) return [];
    const counts = { audio: audioTracks.length, subtitles: subtitleTracks.length, quality: qualityPresets.length };
    const drop = qualityDrop ? qualityDropText(qualityDrop, i18n.language) : null;
    return playerMenuSections(open, counts).map((id): MenuSectionModel => {
      if (id === "audio") return { id, options: audioTracks.map((track) => trackOption(track, selectedAudio)) };
      if (id === "subtitles") return { id, options: subtitleOptions(subtitleTracks, selectedSubtitle, t("panels.subtitlesOff")) };
      return {
        id,
        options: qualityOptions({
          presets: qualityPresets, current: qualityKey, auto: !!autoQualityActive, source: sourceQuality,
          label: (key) => t(key), autoLabel: t("qualityAutoBadge"),
        }),
        footnote: drop ? t(drop.menuKey, drop.values) : undefined,
      };
    });
  }, [open, audioTracks, subtitleTracks, selectedAudio, selectedSubtitle, qualityKey, qualityPresets,
    autoQualityActive, qualityDrop, sourceQuality, t, i18n.language]);

  if (!open || sections.length === 0) return null;
  const frame = panelLayout({
    kind: "menu", width, height, isTablet: Math.min(width, height) >= TABLET_MIN_WIDTH, edges,
  });
  return (
    <PlayerMenuPanel
      // Une clé par menu : passer de l'un à l'autre rejoue l'entrée.
      key={open}
      menu={open}
      frame={frame}
      sections={sections}
      onClose={onClose}
      onSelect={(section, key) => {
        if (section === "audio") onSelectAudio(key as number);
        else if (section === "subtitles") onSelectSubtitle(key as number);
        else onSelectQuality(key as QualityPreset["key"]);
        onClose();
      }}
    />
  );
}
