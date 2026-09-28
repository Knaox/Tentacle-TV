import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, usePersonDetails, usePersonFilmography } from "@tentacle-tv/api-client";
import {
  backdropSource, creditRoleKey, filmographyFacets, formatCalendarDate, normalizeCreditRole, personLife, toCalendarDate,
} from "@tentacle-tv/shared";
import { useSceneMedia, type ScenePerson } from "../../sceneMedia";

/** Ce que la scène montre de la filmographie : une rangée. */
const FILMOGRAPHY_LIMIT = 8;

export interface ScenePersonPage {
  person: ScenePerson | null;
  /** Le générique de la fiche, tel que la rangée « Casting et équipe » le montre. */
  cast: ScenePerson[];
  roles: string[];
  facts: Array<{ label: string; value: string }>;
  countLabel: string | null;
  backdropUrl: string | null;
  posters: string[];
}

/**
 * La page d'une personne, avec les VRAIES lectures de la page (`usePersonDetails`,
 * `usePersonFilmography`) : la première personne du générique du titre du
 * bandeau, sa vie telle que Jellyfin la connaît, ses titres de la bibliothèque.
 * Deux requêtes, faites seulement pendant que la scène est à l'écran — la
 * seule qui en demande : ni l'accueil ni la fiche n'ont lu cette personne.
 */
export function useScenePerson(): ScenePersonPage {
  const { t, i18n } = useTranslation("media");
  const client = useJellyfinClient();
  const media = useSceneMedia();
  const cast = useMemo(() => media.detail?.people ?? [], [media.detail]);
  const person = cast[0] ?? null;
  const details = usePersonDetails(person?.id).data;
  const filmography = usePersonFilmography(person?.id, FILMOGRAPHY_LIMIT).data;

  return useMemo(() => {
    const locale = i18n.language || "fr";
    const life = personLife(details, toCalendarDate(new Date()));
    const facts: ScenePersonPage["facts"] = [];
    if (life.born) {
      const age = life.age !== null && life.died === null ? ` · ${t("personAge", { count: life.age })}` : "";
      facts.push({ label: t("personBorn"), value: `${formatCalendarDate(life.born, locale)}${age}` });
    }
    if (life.birthPlace) facts.push({ label: t("personBirthplace"), value: life.birthPlace });

    const entries = filmography?.entries ?? [];
    const facetRoles = filmographyFacets(entries).roles.map((r) => r.role).filter((r) => r !== "Other");
    const fallbackRole = normalizeCreditRole(person?.kind);
    const roles = (facetRoles.length > 0 ? facetRoles : fallbackRole && fallbackRole !== "Other" ? [fallbackRole] : [])
      .slice(0, 3)
      .map((r) => t(creditRoleKey(r)));

    const decor = backdropSource(entries);
    const posters = entries
      .filter((e) => e.item.ImageTags?.Primary)
      .map((e) => client.getImageUrl(e.item.Id, "Primary", { height: 450, quality: 90, tag: e.item.ImageTags?.Primary }));
    return {
      person,
      cast,
      roles,
      facts,
      countLabel: filmography ? t("personInLibrary", { count: filmography.total }) : null,
      // Le titre du bandeau est dans sa filmographie : son décor ne ment pas en attendant.
      backdropUrl: decor ? client.getImageUrl(decor.Id, "Backdrop", { width: 1920, quality: 80 }) : media.backdrop?.url ?? null,
      posters,
    };
  }, [t, i18n.language, client, media.backdrop, cast, person, details, filmography]);
}
