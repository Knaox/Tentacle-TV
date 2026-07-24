import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { useJellyfinClient, useSeriesWatchState } from "@tentacle-tv/api-client";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { HeroEyebrow } from "./HeroEyebrow";
import { HeroMetaLine } from "./HeroMetaLine";
import { HeroActions } from "./HeroActions";
import { extractMediaQuality } from "../../lib/mediaQuality";
import { RichOverview } from "../../lib/overviewHtml";
import { soberMetaText } from "../media/MetaChips";
import { fadeUp, textCascade } from "../../theme/motion";

interface HeroContentProps {
  item: MediaItem;
  animationKey: number;
}

/**
 * Bloc texte et actions de la bannière, pour un item.
 *
 * Ce bloc repose sur les scrims NOIRS constants de `HeroBackdrop`
 * (`--scrim-media-rgb`) : le texte est donc en tokens `on-media-*` — blanc
 * constant + ombre noire — dans les DEUX schémas. Même sur une affiche claire,
 * du blanc sur un scrim à 49-70 % tient le contraste. Le texte thémé ne
 * reprend que SOUS la bannière, sur le fond de page.
 *
 * `key={animationKey}` remonte le bloc à chaque slide, ce qui rejoue la
 * cascade d'entrée (sur-titre → titre → méta → synopsis → progression → CTA).
 * Sous `prefers-reduced-motion`, les variants sont absents : le contenu
 * s'affiche d'un coup, sans animation.
 */
export function HeroContent({ item, animationKey }: HeroContentProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const client = useJellyfinClient();
  const { data: watchState } = useSeriesWatchState(item.Type === "Series" ? item.Id : undefined);

  const isEpisode = item.Type === "Episode";
  const isSeries = item.Type === "Series";
  const logoId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const logoUrl = item.ImageTags?.Logo
    ? client.getImageUrl(logoId, "Logo", { width: 500, quality: 90 })
    : isEpisode && item.SeriesId
      ? client.getImageUrl(item.SeriesId, "Logo", { width: 500, quality: 90 })
      : null;

  const displayName = isEpisode ? (item.SeriesName ?? item.Name) : item.Name;
  const resumeEp = isEpisode
    ? item
    : isSeries && watchState?.type !== "completed"
      ? watchState?.episode
      : undefined;
  const episodeCode = resumeEp
    ? formatEpisodeCode(resumeEp.ParentIndexNumber, resumeEp.IndexNumber)
    : null;

  const runtime = formatDuration(item.RunTimeTicks);
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const hasProgress = progress > 0 && progress < 100;
  const quality = useMemo(() => extractMediaQuality(item), [item]);

  // Un épisode a déjà une rangée méta chargée : sa qualité part en version
  // sobre dans le sur-titre plutôt qu'en chips sous le titre.
  const eyebrowLabel = hasProgress
    ? t("common:continueLabel")
    : isEpisode
      ? (episodeCode ?? displayName)
      : t("common:play");
  const eyebrowHint = isEpisode ? soberMetaText(quality) : undefined;

  const handlePlay = () => {
    if (isSeries) {
      const epId = watchState?.type !== "completed" ? watchState?.episode?.Id : undefined;
      navigate(epId ? `/watch/${epId}` : `/media/${item.Id}`);
    } else {
      navigate(`/watch/${item.Id}`);
    }
  };

  // Cascade et amplitude viennent de `theme/motion` : la bannière, la fiche
  // média et l'en-tête de bibliothèque révélaient leur texte chacune avec ses
  // propres valeurs, ce qui se remarquait en passant d'une page à l'autre.
  // CONSTANTE de module, jamais un appel de fabrique ici : un objet neuf à
  // chaque rendu fait rejouer toute la cascade par framer.
  const groupVariants = reduced ? undefined : textCascade;
  const itemVariants = reduced ? undefined : fadeUp;

  return (
    <div className="absolute inset-x-0 bottom-[15%] z-10 px-4 sm:px-8 md:bottom-[18%] md:px-14 lg:bottom-[20%]">
      <motion.div
        key={animationKey}
        className="max-w-xl"
        variants={groupVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants} className="mb-3.5">
          <HeroEyebrow label={eyebrowLabel} hint={eyebrowHint} />
        </motion.div>

        {/* Logo / titre — bornés par le `max-w-xl` du parent pour ne jamais
            déborder vers les flèches du carrousel, à droite. */}
        {logoUrl ? (
          <motion.img
            variants={itemVariants}
            src={logoUrl}
            alt={displayName}
            className="mb-4 h-20 max-w-[440px] object-contain object-left drop-shadow-[0_4px_24px_var(--on-media-shadow)] md:h-28 lg:h-32"
            draggable={false}
          />
        ) : (
          <motion.h1
            variants={itemVariants}
            className="mb-4 font-bold text-on-media-primary drop-shadow-[0_3px_12px_var(--on-media-shadow)] line-clamp-2 break-words tracking-tight"
            style={{ fontSize: "clamp(1.75rem, 3.6vw, 3.25rem)", lineHeight: 1.1, letterSpacing: "-0.025em" }}
          >
            {displayName}
          </motion.h1>
        )}

        <motion.div variants={itemVariants} className="mb-3.5">
          <HeroMetaLine item={item} quality={quality} runtime={runtime} showQuality={!isEpisode} />
        </motion.div>

        {item.Overview && (
          <motion.p
            variants={itemVariants}
            className="mb-6 hidden text-base leading-relaxed text-on-media-secondary line-clamp-2 drop-shadow-[0_1px_4px_var(--on-media-shadow)] sm:block"
          >
            <RichOverview text={item.Overview} />
          </motion.p>
        )}

        {hasProgress && (
          <motion.div variants={itemVariants} className="mb-5 flex max-w-md items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-on-media-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, var(--brand), var(--brand-accent))",
                  boxShadow: "0 0 10px rgba(var(--brand-rgb), 0.55)",
                }}
              />
            </div>
            <span className="text-xs font-medium text-on-media-secondary">{Math.round(progress)}%</span>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <HeroActions item={item} onPlay={handlePlay} resuming={hasProgress} episodeCode={episodeCode} />
        </motion.div>
      </motion.div>
    </div>
  );
}
