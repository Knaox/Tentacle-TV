import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { ChevronRightIcon } from "../media/MediaDetailIcons";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import { fadeUp } from "../../theme/motion";

const KIND_KEYS: Partial<Record<MediaItem["Type"], string>> = {
  Movie: "media:kindMovie",
  Series: "media:kindSeries",
  Episode: "media:kindEpisode",
  Season: "media:kindSeason",
  BoxSet: "media:kindCollection",
};

/**
 * Le bloc titre de la fiche : un surtitre qui dit ce qu'on regarde (film,
 * série, épisode, collection), puis le LOGO du titre quand Jellyfin en a un —
 * le lettrage de l'affiche, comme sur les plateformes — et le nom en texte
 * sinon. Le `h1` reste toujours là, masqué derrière le logo : c'est lui que
 * lisent les lecteurs d'écran et la recherche dans la page.
 *
 * Tout est posé sur le voile de la bannière : jetons `on-media` dans les deux
 * thèmes, comme avant.
 */
export const DetailTitle = memo(function DetailTitle({ item, collectionCount }: { item: MediaItem; collectionCount?: number }) {
  const { t } = useTranslation(["media", "common"]);
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const isEpisode = item.Type === "Episode";
  // Un épisode garde son nom en texte : le logo serait celui de la série.
  const logoUrl = !isEpisode && item.ImageTags?.Logo
    ? client.getImageUrl(item.Id, "Logo", { height: 240, quality: 90, tag: item.ImageTags.Logo })
    : null;
  const { broken, reportFailure } = useBrokenImage(logoUrl);
  const showLogo = logoUrl !== null && !broken;
  const kindKey = KIND_KEYS[item.Type];
  const kicker = [
    kindKey ? t(kindKey) : null,
    item.Type === "BoxSet" && collectionCount ? t("media:collectionTitles", { count: collectionCount }) : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      {kicker && (
        <motion.p
          variants={fadeUp}
          className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)]"
        >
          <span aria-hidden className="mr-2 inline-block h-1.5 w-1.5 -translate-y-px rounded-full align-middle" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }} />
          {kicker}
        </motion.p>
      )}
      <motion.h1
        variants={fadeUp}
        className={showLogo
          ? "sr-only"
          : "text-display-3 font-bold text-on-media-primary drop-shadow-[0_3px_12px_var(--on-media-shadow)] line-clamp-2 break-words max-w-3xl md:text-display-2"}
      >
        {item.Name}
      </motion.h1>
      {showLogo && (
        <motion.img
          variants={fadeUp}
          src={logoUrl}
          alt=""
          draggable={false}
          onError={reportFailure}
          className="block h-auto max-h-24 w-auto max-w-[min(28rem,85%)] object-contain object-left drop-shadow-[0_4px_18px_var(--on-media-shadow)] md:max-h-28"
        />
      )}
      {item.OriginalTitle && item.OriginalTitle !== item.Name && (
        <motion.p variants={fadeUp} className="mt-1.5 text-sm text-on-media-secondary">
          {item.OriginalTitle}
        </motion.p>
      )}
      {isEpisode && item.SeriesName && item.SeriesId && (
        <motion.button
          variants={fadeUp}
          type="button"
          onClick={() => navigate(`/media/${item.SeriesId}`)}
          aria-label={t("common:goToSeries")}
          title={t("common:goToSeries")}
          className="group/series mt-1 inline-flex items-center gap-1.5 py-1 text-lg text-on-media-secondary transition-colors hover:text-on-media-primary"
        >
          <span className="underline-offset-4 group-hover/series:underline">
            {item.SeriesName} — S{item.ParentIndexNumber}E{item.IndexNumber}
          </span>
          <ChevronRightIcon />
        </motion.button>
      )}
    </>
  );
});
