import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  formatCalendarDate, formatDuration, readJellyfinDate, streamLanguages, ticksToSeconds, type MediaItem,
} from "@tentacle-tv/shared";
import { RowHeader } from "../rows/RowHeader";

/**
 * « Informations » : ce qui n'est ni une personne ni une image — sortie,
 * durée et heure de fin, classification, genres et studios (qui mènent à leur
 * parcours dans la recherche), langues audio et sous-titres.
 *
 * Une ligne sans donnée n'est pas rendue ; un bloc vide non plus.
 */
export const DetailFacts = memo(function DetailFacts({ item }: { item: MediaItem }) {
  const { t, i18n } = useTranslation(["media", "common"]);
  const locale = i18n.language || "fr";
  const streams = item.MediaSources?.[0]?.MediaStreams ?? [];
  const facts: Array<{ key: string; label: string; value: ReactNode }> = [];

  if (item.OriginalTitle && item.OriginalTitle !== item.Name && item.Type !== "Episode") {
    facts.push({ key: "original", label: t("media:detailOriginalTitle"), value: item.OriginalTitle });
  }

  const released = releaseLabel(item, locale);
  if (released) facts.push({ key: "released", label: t("media:detailReleased"), value: released });

  const runtime = item.Type !== "Series" ? formatDuration(item.RunTimeTicks) : null;
  if (runtime) {
    const end = endsAt(item);
    const time = end?.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    facts.push({
      key: "runtime",
      label: t("media:detailRuntime"),
      value: time ? <>{runtime}<span className="text-content-quaternary"> · {t("media:detailEndsAt", { time })}</span></> : runtime,
    });
  }

  if (item.OfficialRating) facts.push({ key: "rating", label: t("media:detailRating"), value: item.OfficialRating });

  if (item.Genres && item.Genres.length > 0) {
    facts.push({ key: "genres", label: t("media:detailGenres"), value: <Links kind="genre" names={item.Genres} /> });
  }
  if (item.Studios && item.Studios.length > 0) {
    facts.push({ key: "studios", label: t("media:studioLabel"), value: <Links kind="studio" names={item.Studios.map((s) => s.Name)} /> });
  }

  const audio = streamLanguages(streams, "Audio", locale);
  if (audio.length > 0) facts.push({ key: "audio", label: t("media:detailAudio"), value: audio.join(", ") });
  const subs = streamLanguages(streams, "Subtitle", locale);
  if (subs.length > 0) facts.push({ key: "subs", label: t("media:detailSubtitles"), value: subs.join(", ") });

  if (facts.length === 0) return null;

  return (
    <section className="group/row" aria-label={t("media:detailsSection")}>
      <RowHeader title={t("media:detailsSection")} />
      <dl className="row-gutter mt-4 grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {facts.map((f) => (
          <div key={f.key} className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{f.label}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-content-secondary">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
});

/** Genres et studios : chacun ouvre son parcours (`/search?genre=…`). */
function Links({ kind, names }: { kind: "genre" | "studio"; names: string[] }) {
  return (
    <span className="flex flex-wrap gap-x-1">
      {names.map((name, i) => (
        <span key={name}>
          <Link
            to={`/search?${new URLSearchParams({ [kind]: name }).toString()}`}
            className="underline-offset-4 transition-colors hover:text-content-primary hover:underline"
          >
            {name}
          </Link>
          {i < names.length - 1 && ","}
        </span>
      ))}
    </span>
  );
}

/** Film : la date de sortie. Série : ses années de diffusion (« 2008 – 2013 »). */
function releaseLabel(item: MediaItem, locale: string): string | null {
  if (item.Type === "Series") {
    const start = item.ProductionYear;
    const end = readJellyfinDate(item.EndDate)?.year;
    if (!start) return null;
    if (item.Status === "Ended" && end && end !== start) return `${start} – ${end}`;
    return item.Status === "Continuing" ? `${start} –` : String(start);
  }
  const date = readJellyfinDate(item.PremiereDate);
  if (date) return formatCalendarDate(date, locale);
  return item.ProductionYear ? String(item.ProductionYear) : null;
}

/** L'heure de fin si l'on lançait maintenant — depuis la reprise s'il y en a une. */
function endsAt(item: MediaItem): Date | null {
  if (!item.RunTimeTicks) return null;
  const remaining = ticksToSeconds(item.RunTimeTicks) - ticksToSeconds(item.UserData?.PlaybackPositionTicks ?? 0);
  if (!(remaining > 60)) return null;
  return new Date(Date.now() + remaining * 1000);
}
