/**
 * Tout ce que la page d'une personne lit et décide — commun au bureau et au
 * miroir, qui ne diffèrent que par la mise en page.
 *
 * Trois sources : la fiche Jellyfin (portrait, vie, biographie), la
 * filmographie en bibliothèque (index du serveur, Jellyfin en repli) et, sous
 * elle, ce que les plugins connaissent d'autre (`search.person`). Le rôle
 * d'arrivée (`?role=`) présélectionne le filtre quand la personne en a
 * plusieurs, et accompagne la demande au plugin.
 */

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLikedPeople, useLikePerson, usePersonDetails, usePersonFilmography, useUnlikePerson,
} from "@tentacle-tv/api-client";
import {
  backdropSource, filmographyFacets, filterFilmography, normalizeCreditRole, personLife, toCalendarDate,
  type CreditRole, type FilmographyKind,
} from "@tentacle-tv/shared";
import { useExternalFilmography } from "../search/external/useExternalFilmography";

/** Ce que la page demande aux plugins : assez pour une vraie filmographie. */
const EXTERNAL_LIMIT = 40;

export function usePersonPage(personId: string, roleHint: string | null) {
  const { t } = useTranslation("media");
  const details = usePersonDetails(personId);
  const filmography = usePersonFilmography(personId);
  const entries = useMemo(() => filmography.data?.entries ?? [], [filmography.data]);
  const facets = useMemo(() => filmographyFacets(entries), [entries]);
  const life = useMemo(() => personLife(details.data, toCalendarDate(new Date())), [details.data]);
  const backdrop = useMemo(() => backdropSource(entries), [entries]);

  const [kind, setKind] = useState<FilmographyKind>("all");
  // `undefined` : pas encore choisi — le rôle d'arrivée tient lieu de choix,
  // s'il départage vraiment quelque chose.
  const [roleChoice, setRoleChoice] = useState<CreditRole | null | undefined>(undefined);
  const hinted = normalizeCreditRole(roleHint);
  const role = roleChoice !== undefined
    ? roleChoice
    : hinted !== null && facets.roles.length > 1 && facets.roles.some((r) => r.role === hinted) ? hinted : null;
  const shown = useMemo(() => filterFilmography(entries, { kind, role }), [entries, kind, role]);

  const name = details.data?.Name ?? "";
  const external = useExternalFilmography(
    name !== "" ? { name, tmdbId: details.data?.ProviderIds?.Tmdb ?? null, role: roleHint } : null,
    EXTERNAL_LIMIT,
  );
  const owned = useMemo(
    () => entries.map((e) => ({ name: e.item.Name, year: e.item.ProductionYear ?? null })),
    [entries],
  );

  // « J'aime » : même correspondance par nom que le casting de la fiche.
  const { data: likedData } = useLikedPeople();
  const likePerson = useLikePerson();
  const unlikePerson = useUnlikePerson();
  const likedId = name === ""
    ? undefined
    : (likedData?.people ?? []).find((p) => p.name.toLowerCase() === name.toLowerCase())?.personId;
  const toggleLike = useCallback(() => {
    if (name === "") return;
    if (likedId != null) {
      unlikePerson.mutate(likedId);
      return;
    }
    // L'identifiant TMDB, quand Jellyfin le connaît, évite au serveur de deviner par le nom.
    const tmdb = Number(details.data?.ProviderIds?.Tmdb);
    likePerson.mutate({ name, ...(Number.isInteger(tmdb) && tmdb > 0 ? { personId: tmdb } : {}) });
  }, [name, likedId, likePerson, unlikePerson, details.data]);

  const countLabel = filmography.data ? t("personInLibrary", { count: filmography.data.total }) : null;

  return {
    details,
    filmography,
    entries,
    shown,
    facets,
    life,
    backdrop,
    kind,
    setKind,
    role,
    setRole: setRoleChoice as (role: CreditRole | null) => void,
    external,
    owned,
    like: { liked: likedId != null, pending: likePerson.isPending || unlikePerson.isPending, toggle: toggleLike },
    countLabel,
  };
}
