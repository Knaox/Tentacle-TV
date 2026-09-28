/**
 * Ce que l'écran d'une personne lit et décide — le jumeau mobile de
 * `usePersonPage` (web) : fiche Jellyfin, filmographie en bibliothèque (index
 * du serveur, Jellyfin en repli), filtres, puis ce que les extensions savent
 * d'autre. Le rôle d'arrivée présélectionne le filtre et accompagne la
 * demande au plugin.
 */

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLikedPeople, useLikePerson, usePersonDetails, usePersonFilmography, useUnlikePerson,
} from "@tentacle-tv/api-client";
import {
  backdropSource, filmographyFacets, filterFilmography, normalizeCreditRole, personLife, toCalendarDate,
  withoutLibraryTwins, type CreditRole, type FilmographyKind,
} from "@tentacle-tv/shared";
import { useMobileExternalFilmography } from "@/components/search/useMobileExternalSearch";

const EXTERNAL_LIMIT = 40;

export function usePersonScreen(personId: string, roleHint: string | null) {
  const { t } = useTranslation("media");
  const details = usePersonDetails(personId);
  const filmography = usePersonFilmography(personId);
  const entries = useMemo(() => filmography.data?.entries ?? [], [filmography.data]);
  const facets = useMemo(() => filmographyFacets(entries), [entries]);
  const life = useMemo(() => personLife(details.data, toCalendarDate(new Date())), [details.data]);
  const backdrop = useMemo(() => backdropSource(entries), [entries]);

  const [kind, setKind] = useState<FilmographyKind>("all");
  const [roleChoice, setRoleChoice] = useState<CreditRole | null | undefined>(undefined);
  const hinted = normalizeCreditRole(roleHint);
  const role = roleChoice !== undefined
    ? roleChoice
    : hinted !== null && facets.roles.length > 1 && facets.roles.some((r) => r.role === hinted) ? hinted : null;
  const shown = useMemo(() => filterFilmography(entries, { kind, role }), [entries, kind, role]);

  const name = details.data?.Name ?? "";
  const tmdbId = details.data?.ProviderIds?.Tmdb ?? null;
  const external = useMobileExternalFilmography(name !== "" ? { name, tmdbId, role: roleHint } : null, EXTERNAL_LIMIT);
  // Sans ce que la bibliothèque a déjà, et du seul type filtré.
  const outside = useMemo(() => {
    const owned = entries.map((e) => ({ name: e.item.Name, year: e.item.ProductionYear ?? null }));
    return external.results
      .map((result) => ({
        ...result,
        items: withoutLibraryTwins(result.items, owned).filter((item) => kind === "all" || item.kind === kind),
      }))
      .filter((result) => result.items.length > 0);
  }, [external.results, entries, kind]);

  // « J'aime » : même correspondance par nom que le reste de l'app.
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
    const tmdb = Number(tmdbId);
    likePerson.mutate({ name, ...(Number.isInteger(tmdb) && tmdb > 0 ? { personId: tmdb } : {}) });
  }, [name, likedId, tmdbId, likePerson, unlikePerson]);

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
    outside,
    externalPending: external.pending,
    like: { liked: likedId != null, pending: likePerson.isPending || unlikePerson.isPending, toggle: toggleLike },
    countLabel: filmography.data ? t("personInLibrary", { count: filmography.data.total }) : null,
  };
}
