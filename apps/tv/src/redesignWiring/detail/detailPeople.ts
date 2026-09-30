import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { paletteFromBlurHash } from "../../redesign/color/artworkPalette";
import type { CrewGroupModel, PersonModel } from "../../redesign/screens/detail/detailTypes";
import { blurHashOf } from "../cards/cardArtwork";
import { portraitUri } from "./detailImages";
import type { Translate } from "./detailModels";

/**
 * Casting et équipe de la fiche : les `People` et `Studios` que l'item porte
 * déjà (`useMediaItem` les demande) — aucune requête de plus. Une carte par
 * personne : Jellyfin la répète pour chacun de ses rôles.
 */

/** Au-delà, la rangée s'allongerait pour des seconds rôles que personne ne va chercher. */
const CAST_LIMIT = 16;

const CREW: ReadonlyArray<readonly [type: string, key: string]> = [
  ["Director", "media:crewDirector"],
  ["Writer", "media:crewWriter"],
  ["Producer", "media:crewProducer"],
  ["Composer", "media:crewComposer"],
];

export function castOf(client: JellyfinClient, item: MediaItem): PersonModel[] {
  const seen = new Set<string>();
  const cast: PersonModel[] = [];
  for (const person of item.People ?? []) {
    if (person.Type !== "Actor" || seen.has(person.Id)) continue;
    seen.add(person.Id);
    cast.push({
      id: person.Id,
      name: person.Name,
      role: person.Role || undefined,
      imageUri: portraitUri(client, person),
      // Sans portrait, le disque garde la lumière de la personne.
      palette: paletteFromBlurHash(blurHashOf(person as MediaItem, "Primary")) ?? undefined,
    });
    if (cast.length >= CAST_LIMIT) break;
  }
  return cast;
}

/** L'équipe en colonnes : réalisation, scénario, production, musique, studio. */
export function crewOf(item: MediaItem, t: Translate): CrewGroupModel[] {
  const groups: CrewGroupModel[] = [];
  for (const [type, key] of CREW) {
    const names = [...new Set((item.People ?? []).filter((p) => p.Type === type).map((p) => p.Name))];
    if (names.length) groups.push({ key: type, label: t(key), names });
  }
  const studios = (item.Studios ?? []).map((s) => s.Name);
  if (studios.length) groups.push({ key: "Studio", label: t("media:studioLabel"), names: studios });
  return groups;
}
