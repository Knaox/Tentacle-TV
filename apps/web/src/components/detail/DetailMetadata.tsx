import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { formatDuration, playbackEndsAt } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { QualityBadge } from "../media/MediaDetailIcons";
import { extractMediaQuality } from "../../lib/mediaQuality";
import { PremiumQualityBadges } from "../media/PremiumQualityBadges";
import { fadeUp } from "../../theme/motion";

/**
 * La ligne de faits de la scène, lue d'un trait : année · classification ·
 * durée · heure de fin · saisons, puis la qualité (4K, HDR, Dolby) et le son.
 * Dessous, les genres en liens discrets séparés par des points — chacun ouvre
 * son parcours dans la recherche.
 *
 * La note n'est plus ici : elle a sa propre ligne (`DetailScoreline`), en
 * grand, avec les marqueurs. Tout est posé sur le décor : jetons `on-media`.
 *
 * Détection qualité centralisée dans `extractMediaQuality` — même logique que
 * les badges des cartes, pour que « Dolby Vision » ne devienne jamais « HDR ».
 */
interface DetailMetadataProps {
  item: MediaItem;
  /** Faux : les genres sont du texte — page partagée, sans session pour la recherche. */
  linkGenres?: boolean;
}

export function DetailMetadata({ item, linkGenres = true }: DetailMetadataProps) {
  const { t, i18n } = useTranslation(["common", "media"]);
  const isSeries = item.Type === "Series";
  const runtime = item.Type === "BoxSet" ? null : formatDuration(item.RunTimeTicks);
  const end = playbackEndsAt(item, Date.now());
  const endTime = end?.toLocaleTimeString(i18n.language || "fr", { hour: "2-digit", minute: "2-digit" });
  const quality = extractMediaQuality(item);

  const facts: string[] = [];
  if (item.ProductionYear) facts.push(String(item.ProductionYear));
  if (runtime) facts.push(runtime);
  if (endTime) facts.push(t("media:detailEndsAt", { time: endTime }));
  if (isSeries && item.ChildCount != null && item.ChildCount > 0) facts.push(`${item.ChildCount} ${t("common:seasons")}`);
  if (isSeries && item.Status) facts.push(item.Status === "Continuing" ? t("common:ongoing") : t("common:ended"));

  return (
    <>
      <motion.div
        variants={fadeUp}
        className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[0.9375rem] text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)]"
      >
        {item.OfficialRating && (
          <span className="rounded-[5px] border border-on-media-muted px-1.5 py-0.5 text-[11px] font-bold leading-none tracking-wider">
            {item.OfficialRating}
          </span>
        )}
        {facts.map((fact, i) => (
          <Fragment key={fact}>
            {i > 0 && <span aria-hidden className="text-on-media-muted">·</span>}
            <span className={i === 0 ? "font-medium text-on-media-primary" : undefined}>{fact}</span>
          </Fragment>
        ))}
        <span className="flex items-center gap-1.5 [&:empty]:hidden">
          <PremiumQualityBadges quality={quality} compact />
          {quality.surroundLabel && <QualityBadge label={quality.surroundLabel} />}
        </span>
      </motion.div>

      {item.Genres && item.Genres.length > 0 && (
        <motion.p variants={fadeUp} className="mt-2.5 flex flex-wrap items-center gap-x-2 text-sm text-on-media-muted">
          {item.Genres.slice(0, 5).map((g, i) => (
            <Fragment key={g}>
              {i > 0 && <span aria-hidden>·</span>}
              {linkGenres ? (
                <Link
                  to={`/search?${new URLSearchParams({ genre: g }).toString()}`}
                  className="text-on-media-secondary underline-offset-4 transition-colors hover:text-on-media-primary hover:underline"
                >
                  {g}
                </Link>
              ) : (
                <span className="text-on-media-secondary">{g}</span>
              )}
            </Fragment>
          ))}
        </motion.p>
      )}
    </>
  );
}
