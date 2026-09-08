/**
 * Tout ce que la feuille « Garder hors ligne » laisse CHOISIR, et ce qu'elle
 * en déduit : variante, palier, piste audio (ou langue, sur un lot), sous-titre
 * à incruster, auto-suppression — puis la taille annoncée et les
 * avertissements.
 *
 * Sorti du composant parce que la feuille frôlait le plafond de 300 lignes et
 * que ce calcul se relit mieux loin du rendu.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem, MediaStream } from "@tentacle-tv/shared";
import {
  languageDisplayName,
  type DownloadCapabilities,
  type LightPresetId,
  type OfflineVariantCard,
  type OfflineVariantKind,
  type OfflineVariantPlan,
} from "@tentacle-tv/offline-core";
import {
  audioLanguages,
  audioTracks,
  batchSizeBytes,
  imageSubtitleTracks,
  keptAudioTrack,
  type KeepOptions,
} from "../keepTargets";
import { trackLabel } from "./TrackPickerRow";
import type { AutoDeleteValue } from "./AutoDeleteChips";

/** Les paliers qui recompressent : `pmax` n'en est pas un, c'est le remux. */
function lossyPresets(available: readonly string[]): LightPresetId[] {
  const ranked: LightPresetId[] = ["p1080", "p720", "p480"];
  return ranked.filter((preset) => available.includes(preset));
}

export interface KeepChoices {
  kind: OfflineVariantKind | null;
  setKind: (kind: OfflineVariantKind) => void;
  card: OfflineVariantCard | null;
  preset: LightPresetId;
  setPreset: (preset: LightPresetId) => void;
  /** Paliers proposables ; vide = pas de sélecteur. */
  presets: readonly LightPresetId[];
  audioIndex: number | undefined;
  setAudioIndex: (index: number | undefined) => void;
  audioLanguage: string | undefined;
  setAudioLanguage: (language: string | undefined) => void;
  burnIndex: number | undefined;
  setBurnIndex: (index: number | undefined) => void;
  autoDelete: AutoDeleteValue;
  setAutoDelete: (value: AutoDeleteValue) => void;
  options: KeepOptions;
  size: { total: number | null; estimate: boolean };
  audio: MediaStream[];
  imageSubs: MediaStream[];
  languages: Array<{ code: string; label: string }>;
  hints: string[];
}

export function useKeepChoices(
  items: readonly MediaItem[],
  single: MediaItem | null,
  plan: OfflineVariantPlan,
  capabilities: DownloadCapabilities,
): KeepChoices {
  const { i18n } = useTranslation();
  const { t: to } = useTranslation("offline");

  const firstKind = plan.cards[0]?.kind ?? null;
  const [chosenKind, setChosenKind] = useState<OfflineVariantKind | null>(null);
  const kind =
    chosenKind !== null && plan.cards.some((entry) => entry.kind === chosenKind) ? chosenKind : firstKind;

  const presets = useMemo(() => lossyPresets(capabilities.lightPresets), [capabilities.lightPresets]);
  const [chosenPreset, setChosenPreset] = useState<LightPresetId>("p720");
  const preset = presets.includes(chosenPreset) ? chosenPreset : (presets[0] ?? "p720");

  const [audioIndex, setAudioIndex] = useState<number | undefined>(undefined);
  // Sur un lot, le choix porte sur la LANGUE : les index de flux diffèrent
  // d'un épisode à l'autre, la langue non.
  const [audioLanguage, setAudioLanguage] = useState<string | undefined>(undefined);
  const [burnIndex, setBurnIndex] = useState<number | undefined>(undefined);
  const [autoDelete, setAutoDelete] = useState<AutoDeleteValue>(null);

  const options: KeepOptions = useMemo(
    () => ({
      kind: kind ?? "original",
      preset,
      autoDeleteAfterWatch: autoDelete !== null,
      autoDeleteDelayMinutes: autoDelete ?? 0,
      audioStreamIndex: audioIndex,
      audioLanguage,
      burnSubtitleIndex: burnIndex,
    }),
    [kind, preset, autoDelete, audioIndex, audioLanguage, burnIndex],
  );

  const card = plan.cards.find((entry) => entry.kind === kind) ?? null;
  const size = kind === null ? { total: null, estimate: false } : batchSizeBytes(items, kind, preset);
  const audio = useMemo(() => (single ? audioTracks(single) : []), [single]);
  const imageSubs = useMemo(() => (single ? imageSubtitleTracks(single) : []), [single]);
  // Une langue, pas une piste : sur un lot, « Français » se lit mieux que
  // « French - Dolby Digital+ - Stereo », dont les canaux varient d'un
  // épisode à l'autre.
  const languages = useMemo(
    () =>
      audioLanguages(items).map(({ code, stream }) => ({
        code,
        label: languageDisplayName(code, i18n.language) ?? stream.DisplayTitle ?? code,
      })),
    [items, i18n.language],
  );
  // Les paliers Allégé et remux passent par le transcodage de Jellyfin, qui
  // n'en sort jamais qu'une : on dit laquelle. Le premier titre du lot fait foi.
  const kept = useMemo(
    () => (kind !== null && kind !== "original" && items[0] !== undefined ? keptAudioTrack(items[0], options) : null),
    [kind, items, options],
  );
  // Une source SANS aucune piste audio n'a pas « une seule piste conservée » :
  // le message serait faux. `keptAudioTrack` rend `null` dans les deux cas.
  const hasAudio = items.some((item) => audioTracks(item).length > 0);

  const hints: string[] = [];
  if (card !== null && kind === "original" && single !== null) {
    for (const index of card.audio.unplayable) {
      const track = audio.find((stream) => stream.Index === index);
      if (track) hints.push(to("audioUnplayableWarning", { track: trackLabel(track) }));
    }
  }
  // L'avertissement de perte ne vaut que si l'Allégé est le SEUL recours.
  if (kind === "light" && plan.cards.length === 1) hints.push(to("lightOnlyHint"));
  if (kind !== null && kind !== "original" && hasAudio) {
    hints.push(kept === null ? to("singleAudioTrackHint") : to("audioKeptHint", { track: trackLabel(kept) }));
  }
  // Ce que le hors ligne emporte TOUJOURS, et ce qu'il ne sait pas emporter.
  if (kind !== null) hints.push(to("subtitlesAllKeptHint"));
  if (imageSubs.length > 0 && burnIndex === undefined) hints.push(to("imageSubsHint"));
  if (kind === "light" && plan.excluded.some((entry) => entry.reason === "dolbyVision")) {
    hints.push(to("dolbyVisionColorsHint"));
  }

  return {
    kind,
    setKind: setChosenKind,
    card,
    preset,
    setPreset: setChosenPreset,
    presets,
    audioIndex,
    setAudioIndex,
    audioLanguage,
    setAudioLanguage,
    burnIndex,
    setBurnIndex,
    autoDelete,
    setAutoDelete,
    options,
    size,
    audio,
    imageSubs,
    languages,
    hints,
  };
}
