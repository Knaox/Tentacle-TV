/**
 * Tout ce que le dialogue de téléchargement décide — périmètre, sélection,
 * variante, palier, pistes, auto-suppression — et l'envoi en file.
 *
 * Sorti du composant : celui-ci frôlait le plafond de 300 lignes avant que le
 * périmètre n'y entre, et ce calcul se relit mieux loin du rendu.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { seasonKey } from "@tentacle-tv/offline-core";
import type { MediaItem } from "@tentacle-tv/shared";
import { backendUrl } from "../main";
import { useToast } from "../contexts/ToastContext";
import { refreshLibraryPrefsCache } from "../offline/localTrackPrefs";
import { enqueueDownloads } from "./api";
import { audioTracks, batchSizeBytes, buildEnqueueItem, imageSubtitleTracks, type MediaStreamLike } from "./downloadTargets";
import { useDownloadsList } from "./useDownloadState";
import { useDownloadScope, type DownloadMode, type DownloadScopeState } from "./useDownloadScope";
import type { LightPresetId } from "./presets";

export interface DownloadDialogState {
  scope: DownloadScopeState;
  /** Le mode effectif, après élargissement éventuel. */
  mode: DownloadMode;
  /** Les titres RÉELLEMENT mis en file (cases décochées et déjà présents retirés). */
  items: MediaItem[];
  /** Tout le périmètre, cases comprises — la liste que l'on coche. */
  sourceItems: MediaItem[];
  /** Ce qui est déjà complet sur la machine : coché-gris, non décochable. */
  onDevice: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  unchecked: ReadonlySet<string>;
  toggle: (key: string) => void;
  /** Un changement de périmètre repart de « tout coché ». */
  resetSelection: () => void;
  single: MediaItem | null;
  variant: "original" | "light";
  setVariant: (variant: "original" | "light") => void;
  preset: LightPresetId;
  setPreset: (preset: LightPresetId) => void;
  audioIndex: number | undefined;
  setAudioIndex: (index: number | undefined) => void;
  burnIndex: number | undefined;
  setBurnIndex: (index: number | undefined) => void;
  autoDeleteDelay: number | null;
  setAutoDeleteDelay: (delay: number | null) => void;
  audio: MediaStreamLike[];
  imageSubs: MediaStreamLike[];
  sizeOf: (item: MediaItem) => number | null;
  size: number | null;
  submitting: boolean;
  spaceError: { needed: number; free: number } | null;
  start: () => Promise<void>;
}

export function useDownloadDialogState(
  requested: MediaItem[],
  requestedMode: DownloadMode,
  onClose: () => void,
): DownloadDialogState {
  const { t } = useTranslation(["downloads"]);
  const { show } = useToast();
  const userId = useUserId();
  const entries = useDownloadsList();

  const scope = useDownloadScope(requested, requestedMode);
  const sourceItems = scope.items;
  const mode = scope.mode;
  const batch = mode !== "single";
  const series = mode === "series";

  // Déjà sur la machine : ces titres sont cochés-gris, il n'y a rien à refaire.
  const onDevice = useMemo(
    () => new Set(entries.filter((entry) => entry.status === "complete").map((entry) => entry.itemId)),
    [entries],
  );
  // Ce que l'on a DÉCOCHÉ : par saison sur une série, par épisode sinon.
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string): void =>
    setUnchecked((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const resetSelection = (): void => setUnchecked(new Set());

  const items = useMemo(() => {
    if (!batch) return sourceItems;
    return sourceItems.filter((item) => {
      if (onDevice.has(item.Id)) return false;
      return !unchecked.has(series ? seasonKey(item) : item.Id);
    });
  }, [batch, series, sourceItems, onDevice, unchecked]);
  const selected = useMemo(() => new Set(items.map((item) => item.Id)), [items]);
  const single = mode === "single" && items.length === 1 ? (items[0] as MediaItem) : null;

  const [variant, setVariant] = useState<"original" | "light">("original");
  const [preset, setPreset] = useState<LightPresetId>("p720");
  const [audioIndex, setAudioIndex] = useState<number | undefined>(undefined);
  const [burnIndex, setBurnIndex] = useState<number | undefined>(undefined);
  /** null = pas d'auto-suppression ; sinon délai en minutes (0 = immédiat). */
  const [autoDeleteDelay, setAutoDeleteDelay] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [spaceError, setSpaceError] = useState<{ needed: number; free: number } | null>(null);

  const audio = useMemo(() => (single ? audioTracks(single) : []), [single]);
  const imageSubs = useMemo(() => (single ? imageSubtitleTracks(single) : []), [single]);
  const options = useMemo(
    () => ({
      variant,
      preset,
      autoDeleteAfterWatch: autoDeleteDelay !== null,
      autoDeleteDelayMinutes: autoDeleteDelay ?? 0,
      audioStreamIndex: audioIndex,
      burnSubtitleIndex: burnIndex,
    }),
    [variant, preset, autoDeleteDelay, audioIndex, burnIndex],
  );
  const sizeOf = useMemo(() => (item: MediaItem): number | null => batchSizeBytes([item], options), [options]);
  const size = useMemo(() => batchSizeBytes(items, options), [items, options]);

  const start = async (): Promise<void> => {
    if (!userId || submitting || items.length === 0) return;
    const token = localStorage.getItem("tentacle_token");
    if (!token) return;
    setSubmitting(true);
    setSpaceError(null);
    const payload = items.map((item) => buildEnqueueItem(item, options));
    const outcome = await enqueueDownloads(userId, backendUrl, token, payload);
    setSubmitting(false);
    if (!outcome) {
      show("error", t("downloads:startFailed"));
      return;
    }
    if (!outcome.accepted) {
      setSpaceError({ needed: outcome.neededBytes, free: outcome.freeBytes });
      return;
    }
    // Photographie les préférences de langues au moment du téléchargement :
    // elles doivent être disponibles hors ligne même si l'utilisateur ne
    // repasse plus jamais en ligne d'ici la lecture.
    void refreshLibraryPrefsCache(userId, backendUrl);
    show("success", batch ? t("downloads:seasonQueued", { count: items.length }) : t("downloads:queued"));
    onClose();
  };

  return {
    scope, mode, items, sourceItems, onDevice, selected, unchecked, toggle, resetSelection, single,
    variant, setVariant, preset, setPreset, audioIndex, setAudioIndex, burnIndex, setBurnIndex,
    autoDeleteDelay, setAutoDeleteDelay, audio, imageSubs, sizeOf, size, submitting, spaceError, start,
  };
}
