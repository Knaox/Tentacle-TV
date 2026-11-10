import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  formatDuration, playbackEndsAt, releaseLabel, streamLanguages, type MediaItem,
} from "@tentacle-tv/shared";
import { RowHeader } from "../rows/RowHeader";

/**
 * « Informations » : ce qui n'est ni une personne ni une image — sortie,
 * durée et heure de fin, classification, genres et studios (qui mènent à leur
 * parcours dans la recherche), langues audio et sous-titres.
 *
 * Une ligne sans donnée n'est pas rendue ; un bloc vide non plus.
 *
 * `readOnly` (page partagée, visiteur souvent sans session) : genres et studios
 * en texte — la recherche exige un compte —, et pas d'heure de fin : on ne
 * lance rien depuis un partage.
 */
export const DetailFacts = memo(function DetailFacts({ item, readOnly = false, links = !readOnly }: {
  item: MediaItem;
  readOnly?: boolean;
  /** Genres et studios en liens vers la recherche ; la fiche d'un titre gardé les veut en texte (hors ligne, pas de recherche). */
  links?: boolean;
}) {
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
    const end = readOnly ? null : playbackEndsAt(item, Date.now());
    const time = end?.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    facts.push({
      key: "runtime",
      label: t("media:detailRuntime"),
      value: time ? <>{runtime}<span className="tabular-nums text-content-tertiary"> · {t("media:detailEndsAt", { time })}</span></> : runtime,
    });
  }

  if (item.OfficialRating) facts.push({ key: "rating", label: t("media:detailRating"), value: item.OfficialRating });

  if (item.Genres && item.Genres.length > 0) {
    facts.push({ key: "genres", label: t("media:detailGenres"), value: links ? <Links kind="genre" names={item.Genres} /> : item.Genres.join(", ") });
  }
  if (item.Studios && item.Studios.length > 0) {
    facts.push({ key: "studios", label: t("media:studioLabel"), value: links ? <Links kind="studio" names={item.Studios.map((s) => s.Name)} /> : item.Studios.map((s) => s.Name).join(", ") });
  }

  const audio = streamLanguages(streams, "Audio", locale);
  if (audio.length > 0) facts.push({ key: "audio", label: t("media:detailAudio"), value: audio.join(", ") });
  const subs = streamLanguages(streams, "Subtitle", locale);
  if (subs.length > 0) facts.push({ key: "subs", label: t("media:detailSubtitles"), value: subs.join(", ") });

  if (facts.length === 0) return null;

  return (
    <section className="group/row" aria-label={t("media:detailsSection")}>
      <RowHeader title={t("media:detailsSection")} />
      {/* Un panneau du socle : une teinte, pas un liseré ; le surtitre nomme, la valeur se lit. */}
      <div className="row-gutter mt-4">
        <dl className="ui-panel grid grid-cols-1 gap-x-10 gap-y-5 p-5 sm:grid-cols-2 md:p-6 lg:grid-cols-3 xl:grid-cols-4">
          {facts.map((f) => (
            <div key={f.key} className="min-w-0">
              <dt className="ui-eyebrow">{f.label}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-content-primary">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
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
            className="underline decoration-[var(--border-strong)] underline-offset-4 transition-colors duration-hover hover:decoration-current"
          >
            {name}
          </Link>
          {i < names.length - 1 && ","}
        </span>
      ))}
    </span>
  );
}
