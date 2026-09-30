import {
  buildSagaView,
  i18n,
  sagaLabel,
  sagaSummary,
  sagaTitle,
  type ExternalSearchItem,
  type MediaItem,
  type SagaInfo,
  type SagaMember,
} from "@tentacle-tv/shared";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import { paletteFromBlurHash } from "../../../src/redesign/color/artworkPalette";
import type { CrewGroupModel, ExtraModel, PersonModel, SagaModel } from "../../../src/redesign/screens/detail/detailTypes";
import type { BenchData } from "./benchData";
import { cardOf, yearOf } from "./models";

/**
 * Le bas de la fiche : le casting et l'équipe (les `People` et `Studios` de
 * l'item), la saga (`buildSagaView` et ses libellés), les titres similaires
 * (des cartes au modèle partagé), et des extras d'EXEMPLE — le compte de test
 * n'en a aucun.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

type Person = NonNullable<MediaItem["People"]>[number] & { ImageBlurHashes?: Record<string, Record<string, string>> };

/** La distribution, une carte par personne (Jellyfin la répète pour chaque rôle). */
export function castOf(data: BenchData, item: MediaItem, limit = 16): PersonModel[] {
  const seen = new Set<string>();
  const cast: PersonModel[] = [];
  for (const person of (item.People ?? []) as Person[]) {
    if (person.Type !== "Actor" || seen.has(person.Id)) continue;
    seen.add(person.Id);
    const hash = person.ImageBlurHashes?.Primary ? Object.values(person.ImageBlurHashes.Primary)[0] : undefined;
    cast.push({
      id: person.Id,
      name: person.Name,
      role: person.Role ?? undefined,
      imageUri: data.image(person.Id, "Primary"),
      palette: paletteFromBlurHash(hash) ?? undefined,
    });
    if (cast.length >= limit) break;
  }
  return cast;
}

const CREW: Array<[type: string, key: string]> = [
  ["Director", "media:crewDirector"],
  ["Writer", "media:crewWriter"],
  ["Producer", "media:crewProducer"],
  ["Composer", "media:crewComposer"],
];

/** L'équipe en colonnes : réalisation, scénario, production, musique, studio. */
export function crewOf(item: MediaItem): CrewGroupModel[] {
  const groups: CrewGroupModel[] = [];
  for (const [type, key] of CREW) {
    const names = [...new Set((item.People ?? []).filter((p) => p.Type === type).map((p) => p.Name))];
    if (names.length) groups.push({ key: type, label: t(key), names });
  }
  const studios = (item.Studios ?? []).map((s) => s.Name);
  if (studios.length) groups.push({ key: "Studio", label: t("media:studioLabel"), names: studios });
  return groups;
}

/**
 * La saga : la réponse RÉELLE de `/api/sagas`, les films de la bibliothèque,
 * et — le téléviseur n'ayant pas d'extension — les volets manquants tirés des
 * `parts` de TMDB (titre et date, sans image).
 */
export function sagaOf(data: BenchData, item: MediaItem): SagaModel | null {
  const raw = data.snapshot.detail?.[item.Id]?.saga as { collectionId: number; saga: SagaInfo | null; members: SagaMember[] } | undefined;
  if (!raw?.saga) return null;
  const owned = new Set(raw.members.map((member) => member.tmdbId));
  const missing: ExternalSearchItem[] = raw.saga.parts
    .filter((part) => !owned.has(part.tmdbId))
    .map((part) => ({
      id: String(part.tmdbId),
      kind: "movie",
      title: part.title,
      year: part.releaseDate ? Number(part.releaseDate.slice(0, 4)) : null,
      subtitle: null,
      imageUrl: null,
      href: "",
      badge: null,
      tmdbId: part.tmdbId,
    }));
  const view = buildSagaView({
    response: { collectionId: raw.collectionId, saga: raw.saga, members: raw.members },
    items: data.items(raw.members.map((member) => member.itemId)),
    external: [{ pluginId: "tmdb", items: missing }],
    currentId: item.Id,
  });
  if (!view) return null;
  return {
    title: sagaTitle(i18n.t, view),
    summary: sagaSummary(i18n.t, view),
    entries: view.entries.map((entry) => {
      const label = sagaLabel(i18n.t, entry);
      return entry.kind === "library"
        ? { key: entry.key, card: cardOf(data, entry.item, yearOf(entry.item)), rank: label.rank, cue: label.cue, current: entry.cue === "current" }
        : { key: entry.key, missing: { title: entry.item.title, year: entry.item.year ? String(entry.item.year) : undefined }, rank: label.rank, cue: label.cue };
    }),
  };
}

export function similarOf(data: BenchData, item: MediaItem): CardModel[] {
  return data.items(data.snapshot.detail?.[item.Id]?.similar).map((it) => cardOf(data, it, yearOf(it)));
}

/**
 * Des extras d'EXEMPLE (le compte n'en a pas) : les libellés de genre que
 * Jellyfin donne aux fichiers (`extraKindLabel`), sur les VRAIES images du
 * titre — et une vidéo distante retirée, grisée.
 */
export function extrasExample(data: BenchData, item: MediaItem): ExtraModel[] {
  const backdrop = data.image(item.Id, "Backdrop");
  const thumb = data.image(item.Id, "Thumb") ?? backdrop;
  return [
    { id: "trailer", title: t("common:extraKindTrailer"), subtitle: t("common:extraKindTrailer"), imageUri: backdrop },
    { id: "bts", title: t("common:extraKindBehindTheScenes"), subtitle: t("common:extraKindFeaturette"), imageUri: thumb },
    { id: "interview", title: t("common:extraNumbered", { kind: t("common:extraKindInterview"), number: 1 }), subtitle: t("common:extraKindInterview"), imageUri: backdrop },
    { id: "teaser", title: t("common:extraKindTeaser"), subtitle: `${t("common:extraKindTeaser")} · YouTube`, imageUri: thumb, unavailable: true },
  ];
}
