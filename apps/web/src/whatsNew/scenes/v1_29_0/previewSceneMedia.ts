import { formatDuration } from "@tentacle-tv/shared";
import type { SceneMedia, ScenePoster } from "../../sceneMedia";

const TICKS_PER_MINUTE = 600_000_000;

/** Ce que la mini-carte de la scène montre du titre survolé — de vraies images, jamais un aplat. */
export interface SceneTrailer {
  poster: ScenePoster | null;
  title: string;
  /** L'image du titre, montrée pendant l'agrandissement (son décor, sinon son affiche). */
  still: string | null;
  /** Les plans de la « bande-annonce » : les décors de sa fiche, sinon l'image du titre. */
  shots: string[];
  logoUrl: string | null;
  /** Les faits du bandeau, dans son ordre : année, classification, note globale, durée — rien d'inconnu. */
  facts: { year: string | null; rating: string | null; community: number | null; runtime: string | null };
  /** Les genres, trois au plus. */
  genres: string[];
}

/** « Not Rated », « Unrated » : une absence de classification (règle de `cards/preview/previewInfo.ts`). */
const UNRATED = /^(?:nr|ur|unrated|not rated)$/i;
/** Le préfixe de PAYS (« FR-12 » → « 12 »), jamais celui d'un système (« PG-13 », « TV-MA »). */
const COUNTRY_PREFIX = /^(?!PG-|TV-|NC-)[A-Z]{2}-(?=\S)/;

function ratingOf(raw: string | null | undefined): string | null {
  const rating = raw?.trim().replace(COUNTRY_PREFIX, "") ?? "";
  return rating && !UNRATED.test(rating) ? rating : null;
}

/**
 * Le titre que la scène survole : celui du bandeau de l'accueil quand son
 * affiche est dans la rangée — sa fiche (`media.detail`) apporte alors son
 * logo, sa durée et les décors qui font les plans de la vidéo. Sinon la
 * première affiche, avec son seul décor.
 */
export function sceneTrailer(media: SceneMedia): SceneTrailer {
  const detail = media.detail;
  const poster = (detail && media.posters.find((p) => p.id === detail.id)) ?? media.posters[0] ?? null;
  const own = detail && poster && detail.id === poster.id ? detail : null;
  const still = poster?.backdropUrl ?? own?.gallery[0] ?? poster?.url ?? null;
  const shots = own && own.gallery.length > 0 ? own.gallery.slice(0, 2) : still ? [still] : [];
  const runtime = own?.type === "Movie" && own.runtimeMinutes ? formatDuration(own.runtimeMinutes * TICKS_PER_MINUTE) : null;
  return {
    poster,
    title: poster?.title ?? "",
    still,
    shots,
    logoUrl: own?.logoUrl ?? null,
    facts: {
      year: poster?.year ? String(poster.year) : null,
      rating: ratingOf(own?.officialRating),
      community: poster?.rating ?? null,
      runtime,
    },
    genres: own?.genres.slice(0, 3) ?? [],
  };
}

/** Les autres affiches de la rangée, sans le titre survolé, en boucle sur ce qu'on a. */
export function otherPoster(media: SceneMedia, hovered: ScenePoster | null, index: number): ScenePoster | null {
  const others = media.posters.filter((p) => p.id !== hovered?.id);
  if (others.length === 0) return null;
  return others[index % others.length];
}
