import { useTranslation } from "react-i18next";
import { formatBitrateMbps, type QualityKey, type QualityPreset, type SourceQuality } from "@tentacle-tv/shared";
import type { TrackOption } from "../types";
import { PopupMenu, type PopupBadge, type PopupSection } from "./PopupMenu";

interface Props {
  showSettings: boolean;
  showSubtitles: boolean;
  audioTracks: TrackOption[];
  subtitleTracks: TrackOption[];
  selectedAudio: number;
  /** `-1` = sous-titres coupés (le `null` du lecteur web). */
  selectedSubtitle: number;
  qualityKey: QualityKey;
  qualityPresets: readonly QualityPreset[];
  autoQualityActive?: boolean;
  sourceQuality?: SourceQuality;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  /** Absent : le lecteur ne sait pas changer de palier (HLS natif figé). */
  onSelectQuality?: (key: QualityKey) => void;
  onCloseSettings: () => void;
  onCloseSubtitles: () => void;
}

/**
 * Les deux pop-ups du lecteur de l'app (`PlayerSettingsMenus`) : Réglages
 * (audio, puis qualité avec les pastilles Auto / DV / HDR / Atmos, la
 * résolution de l'original et le débit des paliers) et Sous-titres
 * (« Désactivés » en tête). Choisir ferme le menu.
 */
export function SettingsMenus({
  showSettings, showSubtitles, audioTracks, subtitleTracks,
  selectedAudio, selectedSubtitle, qualityKey, qualityPresets, autoQualityActive, sourceQuality,
  onSelectAudio, onSelectSubtitle, onSelectQuality, onCloseSettings, onCloseSubtitles,
}: Props) {
  const { t } = useTranslation("player");

  const settingsSections: PopupSection[] = [];
  if (audioTracks.length > 0) {
    settingsSections.push({
      title: t("audioLabel"),
      options: audioTracks.map((tr) => ({ key: tr.index, label: tr.label, active: selectedAudio === tr.index })),
      onSelect: (k) => { onSelectAudio(k as number); onCloseSettings(); },
    });
  }
  if (onSelectQuality && qualityPresets.length > 0) {
    settingsSections.push({
      title: t("quality").toUpperCase(),
      options: qualityPresets.map((p) => {
        const isOriginal = p.key === "original";
        const badges: PopupBadge[] = [
          ...(autoQualityActive && qualityKey === p.key ? [{ label: t("qualityAutoBadge"), tone: "purple" as const }] : []),
          ...(isOriginal && sourceQuality?.isDolbyVision ? [{ label: "DV", tone: "purple" as const }] : []),
          ...(isOriginal && sourceQuality?.isHDR ? [{ label: "HDR", tone: "amber" as const }] : []),
          ...(isOriginal && sourceQuality?.isDolbyAtmos ? [{ label: "Atmos", tone: "amber" as const }] : []),
        ];
        return {
          key: p.key,
          label: t(p.key),
          active: qualityKey === p.key,
          suffix: isOriginal && sourceQuality?.resolution ? `— ${sourceQuality.resolution}` : undefined,
          badges: badges.length > 0 ? badges : undefined,
          rightChip: !isOriginal && p.bitrate ? { label: formatBitrateMbps(p.bitrate), tone: "zinc" as const } : undefined,
        };
      }),
      onSelect: (k) => { onSelectQuality(k as QualityKey); onCloseSettings(); },
    });
  }

  return (
    <>
      <PopupMenu visible={showSettings} title={t("settings")} sections={settingsSections} onClose={onCloseSettings} />
      <PopupMenu
        visible={showSubtitles}
        title={t("subtitles")}
        sections={[{
          title: t("subtitlesLabel"),
          options: subtitleTracks.map((tr) => ({ key: tr.index, label: tr.label, active: selectedSubtitle === tr.index })),
          onSelect: (k) => { onSelectSubtitle(k as number); onCloseSubtitles(); },
          showDisabled: {
            label: t("disabled"),
            active: selectedSubtitle === -1,
            onSelect: () => { onSelectSubtitle(-1); onCloseSubtitles(); },
          },
        }]}
        onClose={onCloseSubtitles}
      />
    </>
  );
}
