import { memo } from "react";
import { Link } from "react-router-dom";
import type { ViewingStatsPerson } from "@tentacle-tv/shared";
import { useStatsFormat } from "./useStatsFormat";

const TMDB_PROFILE = "https://image.tmdb.org/t/p/w185";

/**
 * Les visages les plus retrouvés : portrait rond (initiale sans portrait),
 * nom, nombre de titres puis temps passé. Toucher un visage lance la
 * recherche de son nom — ses autres titres de la bibliothèque.
 */
export const PeopleRail = memo(function PeopleRail({ people, ariaLabel }: { people: ViewingStatsPerson[]; ariaLabel: string }) {
  const f = useStatsFormat();
  return (
    <ul aria-label={ariaLabel} className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 pt-1">
      {people.map((p) => {
        // Le nombre de titres d'abord : c'est lui qui classe ; le temps ne fait que départager.
        const caption = `${f.t("personTitles", { count: p.titles })} · ${f.duration(p.seconds)}`;
        return (
          <li key={`${p.role}-${p.tmdbId}`} className="w-[88px] shrink-0 sm:w-[100px]">
            <Link
              to={`/search?q=${encodeURIComponent(p.name)}`}
              aria-label={`${p.name}, ${caption}`}
              className="group block cursor-pointer rounded-xl text-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
            >
              <span className="relative mx-auto block h-[72px] w-[72px] overflow-hidden rounded-full bg-fill-soft ring-1 ring-line-subtle sm:h-20 sm:w-20">
                {p.profilePath ? (
                  <img
                    src={`${TMDB_PROFILE}${p.profilePath}`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-content-disabled">
                    {p.name.charAt(0)}
                  </span>
                )}
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-fill-soft opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              </span>
              <span className="mt-2 line-clamp-2 block text-xs font-semibold leading-snug text-content-primary">{p.name}</span>
              <span className="mt-0.5 block truncate text-[11px] tabular-nums text-content-tertiary">{caption}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
});
