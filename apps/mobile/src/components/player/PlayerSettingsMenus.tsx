import { useTranslation } from "react-i18next";
import { formatBitrateMbps, type SourceQuality } from "@tentacle-tv/shared";
import type { QualityKey, QualityPreset } from "../../hooks/usePlayerPlayback";
import { PlayerPopupMenu } from "./PlayerPopupMenu";

interface Track { index: number; label: string }

interface Props {
  showSettings: boolean;
  showSubtitles: boolean;
  audioTracks: Track[];
  subtitleTracks: Track[];
  selectedAudio: number;
  selectedSubtitle: number;
  qualityKey: QualityKey;
  /** Paliers calculés d'après la source (cf. construireEchelleQualite). */
  qualityPresets: readonly QualityPreset[];
  sourceQuality: SourceQuality;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  onSelectQuality: (key: QualityKey) => void;
  onCloseSettings: () => void;
  onCloseSubtitles: () => void;
}

/** Pop-ups Réglages (audio + qualité) et Sous-titres — extraits de l'overlay
 *  pour garder MobilePlayerOverlay sous 300 lignes. */
export function PlayerSettingsMenus({
  showSettings, showSubtitles, audioTracks, subtitleTracks,
  selectedAudio, selectedSubtitle, qualityKey, qualityPresets, sourceQuality,
  onSelectAudio, onSelectSubtitle, onSelectQuality,
  onCloseSettings, onCloseSubtitles,
}: Props) {
  const { t } = useTranslation("player");

  return (
    <>
      <PlayerPopupMenu
        visible={showSettings}
        title={t("settings")}
        sections={[
          ...(audioTracks.length > 0 ? [{
            title: t("audioLabel"),
            options: audioTracks.map((tr) => ({ key: tr.index, label: tr.label, active: selectedAudio === tr.index })),
            onSelect: (k: string | number) => { onSelectAudio(k as number); onCloseSettings(); },
          }] : []),
          {
            title: t("quality").toUpperCase(),
            options: qualityPresets.map((p) => {
              const isOriginal = p.key === "original";
              const badges = isOriginal ? [
                ...(sourceQuality.isDolbyVision ? [{ label: "DV", tone: "purple" as const }] : []),
                ...(sourceQuality.isHDR ? [{ label: "HDR", tone: "amber" as const }] : []),
                ...(sourceQuality.isDolbyAtmos ? [{ label: "Atmos", tone: "amber" as const }] : []),
              ] : undefined;
              const suffix = isOriginal && sourceQuality.resolution ? `— ${sourceQuality.resolution}` : undefined;
              const rightChip = !isOriginal && p.bitrate
                ? { label: formatBitrateMbps(p.bitrate), tone: "zinc" as const } : undefined;
              return { key: p.key, label: t(p.key), active: qualityKey === p.key, suffix, badges, rightChip };
            }),
            onSelect: (k: string | number) => { onSelectQuality(k as QualityKey); onCloseSettings(); },
          },
        ]}
        onClose={onCloseSettings}
      />

      <PlayerPopupMenu
        visible={showSubtitles}
        title={t("subtitles")}
        sections={[{
          title: t("subtitlesLabel"),
          options: subtitleTracks.map((tr) => ({ key: tr.index, label: tr.label, active: selectedSubtitle === tr.index })),
          onSelect: (k: string | number) => { onSelectSubtitle(k as number); onCloseSubtitles(); },
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
