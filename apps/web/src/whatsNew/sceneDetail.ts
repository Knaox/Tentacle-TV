import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/** Une personne du générique, telle que la fiche la montre. */
export interface ScenePerson {
  id: string;
  name: string;
  /** Personnage (acteur) ou métier Jellyfin brut (Director, Writer…). */
  role: string | null;
  kind: string;
  portraitUrl: string | null;
}

/**
 * La fiche du titre mis en avant, telle que la page de fiche la lit
 * (`useMediaItem`) : logo, note, durée, décors de la galerie, casting.
 */
export interface SceneDetail {
  id: string;
  title: string;
  type: MediaItem["Type"];
  logoUrl: string | null;
  rating: number | null;
  /** Durée totale en minutes — base du « Reste … » de la scène. */
  runtimeMinutes: number | null;
  /** 0..1 : la reprise réelle, s'il y en a une. */
  progress: number | null;
  /** Décors de la galerie, en taille de vignette de scène. */
  gallery: string[];
  people: ScenePerson[];
}

const TICKS_PER_MINUTE = 600_000_000;
const GALLERY_MAX = 4;
const PEOPLE_MAX = 6;

/**
 * Ramène la fiche Jellyfin à ce que les scènes montrent. Mêmes recettes d'URL
 * que la fiche (logo 320 de haut) et le casting (portrait 320 de haut) : ce
 * qu'on a déjà vu sur la fiche sort du cache.
 */
export function toSceneDetail(client: JellyfinClient, item: MediaItem): SceneDetail {
  const logoTag = item.ImageTags?.Logo;
  const gallery = (item.BackdropImageTags ?? []).slice(0, GALLERY_MAX).map((tag, index) =>
    client.getImageUrl(item.Id, "Backdrop", { width: 1280, quality: 80, tag, index }),
  );
  // Les visages d'abord : un casting d'initiales raconterait mal la page d'une personne.
  const people = [...(item.People ?? [])]
    .sort((a, b) => Number(Boolean(b.PrimaryImageTag)) - Number(Boolean(a.PrimaryImageTag)))
    .slice(0, PEOPLE_MAX)
    .map((person) => ({
      id: person.Id,
      name: person.Name,
      role: person.Role?.trim() || null,
      kind: person.Type,
      portraitUrl: person.PrimaryImageTag
        ? client.getImageUrl(person.Id, "Primary", { height: 320, quality: 85, tag: person.PrimaryImageTag })
        : null,
    }));
  const played = item.UserData?.PlayedPercentage;
  return {
    id: item.Id,
    title: item.Name,
    type: item.Type,
    logoUrl: logoTag ? client.getImageUrl(item.Id, "Logo", { height: 320, quality: 90, tag: logoTag }) : null,
    rating: item.CommunityRating ?? null,
    runtimeMinutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / TICKS_PER_MINUTE) : null,
    progress: played != null && played > 0 && played < 100 ? played / 100 : null,
    gallery,
    people,
  };
}
