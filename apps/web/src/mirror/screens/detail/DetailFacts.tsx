import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  formatDuration, playbackEndsAt, releaseLabel, streamLanguages, type MediaItem,
} from "@tentacle-tv/shared";
import { CONTENT_MAX_WIDTH } from "../../responsive";

/**
 * `DetailFacts` de l'app : « Informations » (18 gras), puis deux colonnes —
 * libellé 10,5 en capitales, valeur 14 — pour la sortie, la durée et l'heure
 * de fin, la classification, les studios et les langues.
 */
export const DetailFacts = memo(function DetailFacts({ item }: { item: MediaItem }) {
  const { t, i18n } = useTranslation("media");
  const locale = i18n.language || "fr";
  const streams = item.MediaSources?.[0]?.MediaStreams ?? [];
  const facts: Array<{ key: string; label: string; value: string }> = [];

  if (item.OriginalTitle && item.OriginalTitle !== item.Name && item.Type !== "Episode") {
    facts.push({ key: "original", label: t("detailOriginalTitle"), value: item.OriginalTitle });
  }
  const released = releaseLabel(item, locale);
  if (released) facts.push({ key: "released", label: t("detailReleased"), value: released });
  const runtime = item.Type !== "Series" ? formatDuration(item.RunTimeTicks) : null;
  if (runtime) {
    const time = playbackEndsAt(item, Date.now())?.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    facts.push({ key: "runtime", label: t("detailRuntime"), value: time ? `${runtime} · ${t("detailEndsAt", { time })}` : runtime });
  }
  if (item.OfficialRating) facts.push({ key: "rating", label: t("detailRating"), value: item.OfficialRating });
  if (item.Studios && item.Studios.length > 0) {
    facts.push({ key: "studios", label: t("studioLabel"), value: item.Studios.map((s) => s.Name).join(", ") });
  }
  const audio = streamLanguages(streams, "Audio", locale);
  if (audio.length > 0) facts.push({ key: "audio", label: t("detailAudio"), value: audio.join(", ") });
  const subs = streamLanguages(streams, "Subtitle", locale);
  if (subs.length > 0) facts.push({ key: "subs", label: t("detailSubtitles"), value: subs.join(", ") });

  if (facts.length === 0) return null;
  return (
    <section className="mt-6 px-4" style={{ maxWidth: CONTENT_MAX_WIDTH }}>
      <h3 className="mb-3 text-[18px] font-bold leading-[23px] tracking-[-0.4px] text-content-primary">{t("detailsSection")}</h3>
      <dl className="grid grid-cols-2 gap-y-3">
        {facts.map((f) => (
          <div key={f.key} className="min-w-0 pr-3">
            <dt className="text-[10.5px] font-semibold uppercase tracking-[0.9px] text-content-quaternary">{f.label}</dt>
            <dd className="mt-0.5 text-[14px] font-medium leading-[19px] text-content-secondary">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
});
