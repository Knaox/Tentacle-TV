import {
  cardActionEntries,
  externalCardActionEntries,
  formatEpisodeCode,
  formatPosition,
  i18n,
  resolveBannerImage,
  resolveCardOverlay,
  resolveExternalCardOverlay,
  type CardOverlayVariant,
  type CardToggleStates,
  type MediaItem,
} from "@tentacle-tv/shared";
import type { SheetActionModel, SheetHeaderModel } from "../../../src/redesign/screens/sheet/ActionSheetView";
import type { BenchData } from "./benchData";
import { episodeLabel, seriesOf, yearOf } from "./models";

/**
 * Les feuilles d'actions du banc, résolues comme le câblage le fera : le
 * modèle partagé (`resolveCardOverlay` → `cardActionEntries`, ou sa version
 * hors bibliothèque) décide des lignes et de leur ordre, les libellés passent
 * par l'espace `cards`, le complément de la lecture par `useCardSheetPlay`
 * (position d'une reprise, épisode d'une série).
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

export interface SheetSceneModel {
  header: SheetHeaderModel;
  actions: SheetActionModel[];
  rate: boolean;
}

/** L'état des bascules, lu comme `useCardToggles` (Ma liste = `Likes` hors série). */
function statesOf(item: MediaItem, force?: Partial<CardToggleStates>): CardToggleStates {
  const ud = item.UserData;
  return {
    watchlist: ud?.Likes === true,
    favorite: ud?.IsFavorite === true,
    watched: ud?.Played === true,
    ...force,
  };
}

/** Ce que la lecture ajoute à son bouton — `useCardSheetPlay`, sur l'instantané. */
function playOf(data: BenchData, item: MediaItem): { resume: boolean; detail: string | null } | null {
  if (item.Type === "Series") {
    const next = data.list("nextUp").find((ep) => ep.SeriesId === item.Id) ?? data.list("resume").find((ep) => ep.SeriesId === item.Id);
    if (!next) return { resume: false, detail: null };
    const started = (next.UserData?.PlaybackPositionTicks ?? 0) > 0;
    return { resume: started, detail: formatEpisodeCode(next.ParentIndexNumber, next.IndexNumber, { style: "padded" }) };
  }
  if (item.Type !== "Movie" && item.Type !== "Episode") return null;
  const ticks = item.UserData?.PlaybackPositionTicks ?? 0;
  const resume = ticks > 0 && item.UserData?.Played !== true;
  return { resume, detail: resume ? formatPosition(ticks) : null };
}

function headerOf(data: BenchData, item: MediaItem, shape: "poster" | "landscape"): SheetHeaderModel {
  if (shape === "landscape") {
    const banner = resolveBannerImage(item);
    const series = seriesOf(data, item);
    return {
      shape,
      title: item.Name ?? "",
      subtitle: item.Type === "Episode" ? `${series?.Name ?? item.SeriesName ?? ""} · ${episodeLabel(item)}` : yearOf(item),
      imageUri: (banner ? data.image(banner.id, banner.type) : undefined) ?? (item.SeriesId ? data.image(item.SeriesId, "Thumb") : undefined),
    };
  }
  const art = item.Type === "Episode" ? seriesOf(data, item) ?? item : item;
  return { shape, title: art.Name ?? "", subtitle: yearOf(art), imageUri: data.image(art.Id, "Primary") };
}

/** La feuille d'un titre de la bibliothèque. */
export function librarySheet(
  data: BenchData,
  item: MediaItem,
  variant: CardOverlayVariant,
  options: { force?: Partial<CardToggleStates>; providerFilter?: boolean } = {},
): SheetSceneModel {
  const play = playOf(data, item);
  const overlay = resolveCardOverlay({
    variant,
    inLibrary: true,
    playable: play !== null,
    resume: play?.resume,
    rateable: true,
    // Rien ne se garde hors ligne sur un téléviseur.
    offline: false,
  });
  const actions: SheetActionModel[] = cardActionEntries(overlay, statesOf(item, options.force)).map((entry) => ({
    kind: entry.kind,
    label: t(`cards:${entry.labelKey}`),
    active: entry.active,
    detail: entry.kind === "play" ? play?.detail : null,
  }));
  if (variant === "reco" && options.providerFilter) actions.push({ kind: "providersAll", label: t("reco:providersAll") });
  return { header: headerOf(data, item, variant === "landscape" ? "landscape" : "poster"), actions, rate: overlay.rate };
}

/** La feuille d'un titre ABSENT de la bibliothèque (Vigie) : « Demander » en tête. */
export function externalSheet(data: BenchData, item: MediaItem, requestLabel: string): SheetSceneModel {
  const overlay = resolveExternalCardOverlay({
    variant: "reco",
    request: { mode: "direct", label: requestLabel, href: null },
    identified: true,
  });
  const actions: SheetActionModel[] = externalCardActionEntries(overlay, { watchlist: false, favorite: false }).map((entry) => ({
    kind: entry.kind,
    label: entry.label ?? t(`cards:${entry.labelKey}`),
    active: entry.active,
  }));
  return { header: headerOf(data, item, "poster"), actions, rate: overlay.rate };
}
