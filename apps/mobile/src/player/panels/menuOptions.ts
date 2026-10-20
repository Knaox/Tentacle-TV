import { formatBitrateMbps, type QualityPreset, type SourceQuality } from "@tentacle-tv/shared";
import { parseTrackLabel } from "../../lib/playerUtils";
import type { PlayerMenuSection } from "./playerMenus";

/** Une ligne de menu, sans rien de visuel (cf. `PanelOptionRow`). */
export interface MenuOption {
  key: string | number;
  title: string;
  detail?: string;
  tags?: readonly string[];
  trailing?: string;
  selected: boolean;
}

export interface MenuSectionModel {
  id: PlayerMenuSection;
  options: MenuOption[];
  /** Le pied de section d'iOS : pourquoi la qualité baisse en Auto. */
  footnote?: string;
}

interface Track { index: number; label: string }

/** « Désactivés » d'abord, puis les pistes — l'ordre du lecteur d'Apple. */
export const SUBTITLES_OFF = -1;

/** Une piste : son nom en titre, langue et format en détail (plus de pastilles colorées). */
export function trackOption(track: Track, selected: number): MenuOption {
  const { title, lang, codec } = parseTrackLabel(track.label);
  const detail = [lang?.toUpperCase(), codec?.toUpperCase()].filter(Boolean).join(" · ");
  return { key: track.index, title, detail: detail || undefined, selected: track.index === selected };
}

export function subtitleOptions(tracks: readonly Track[], selected: number, offLabel: string): MenuOption[] {
  return [
    { key: SUBTITLES_OFF, title: offLabel, selected: selected === SUBTITLES_OFF },
    ...tracks.map((track) => trackOption(track, selected)),
  ];
}

export interface QualityOptionsInput {
  presets: readonly QualityPreset[];
  current: QualityPreset["key"];
  /** Le mode Auto a choisi le palier courant (aucun choix manuel). */
  auto: boolean;
  source: SourceQuality;
  label: (key: QualityPreset["key"]) => string;
  autoLabel: string;
}

/**
 * Les paliers : la résolution de la source et ses formats (Dolby Vision, HDR,
 * Atmos) sur l'Original, le débit en bout de ligne sur les autres, « Auto »
 * sur le palier que le mode automatique a pris.
 */
export function qualityOptions(input: QualityOptionsInput): MenuOption[] {
  const { presets, current, auto, source, label, autoLabel } = input;
  return presets.map((preset) => {
    const isOriginal = preset.key === "original";
    const selected = preset.key === current;
    const tags = [
      ...(isOriginal && source.isDolbyVision ? ["Dolby Vision"] : []),
      ...(isOriginal && source.isHDR && !source.isDolbyVision ? ["HDR"] : []),
      ...(isOriginal && source.isDolbyAtmos ? ["Atmos"] : []),
    ];
    const bitrate = isOriginal ? "" : formatBitrateMbps(preset.bitrate);
    const trailing = [selected && auto ? autoLabel : "", bitrate].filter(Boolean).join(" · ");
    return {
      key: preset.key,
      title: label(preset.key),
      detail: isOriginal && source.resolution ? source.resolution : undefined,
      tags: tags.length > 0 ? tags : undefined,
      trailing: trailing || undefined,
      selected,
    };
  });
}
