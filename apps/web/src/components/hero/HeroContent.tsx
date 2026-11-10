import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { useJellyfinClient, useSeriesWatchState } from "@tentacle-tv/api-client";
import { formatDuration, formatEpisodeCode, seriesPlayTarget } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { HeroEyebrow } from "./HeroEyebrow";
import { HeroMetaLine } from "./HeroMetaLine";
import { HeroActions } from "./HeroActions";
import { heroLogoUrl } from "./heroLogo";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import { extractMediaQuality } from "../../lib/mediaQuality";
import { RichOverview } from "../../lib/overviewHtml";
import { soberMetaText } from "../media/MetaChips";
import { fadeUp, textCascade } from "../../theme/motion";

interface HeroContentProps {
  item: MediaItem;
  animationKey: number;
  /** L'image affichée par la bannière (cf. HeroActions). */
  imageUrl?: string | null;
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
export function HeroContent({ item, animationKey, imageUrl }: HeroContentProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const client = useJellyfinClient();
  const { data: watchState } = useSeriesWatchState(item.Type === "Series" ? item.Id : undefined);

  const isEpisode = item.Type === "Episode";
  const isSeries = item.Type === "Series";
  // Le logo que la donnée annonce (celui de la série pour un épisode), sinon
  // le titre écrit ; un logo annoncé qui échoue quand même lui rend la place.
  const logoUrl = heroLogoUrl(client, item);
  const { broken: logoBroken, reportFailure: reportLogoFailure } = useBrokenImage(logoUrl);
  const showLogo = logoUrl !== null && !logoBroken;

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
      // La règle des bannières : l'épisode à suivre, une série vue se revoit depuis le premier.
      const target = seriesPlayTarget(watchState);
      navigate(target.kind === "detail" ? `/media/${item.Id}` : `/watch/${target.episodeId}`);
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
    // Ancré en BAS de la carte, sur la ligne des pastilles (le prototype validé) — plus au
    // cinquième de sa hauteur : le texte ne flotte plus au milieu de l'image.
    // La marge gauche laisse la flèche « précédent » (toujours là) hors du texte.
    <div className="absolute inset-x-0 bottom-6 z-10 pl-16 pr-4 sm:pr-8 md:bottom-10 md:pl-20 md:pr-12">
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
        {showLogo ? (
          <motion.img
            variants={itemVariants}
            src={logoUrl}
            alt={displayName}
            onError={reportLogoFailure}
            className="mb-4 h-20 max-w-[440px] object-contain object-left drop-shadow-[0_4px_24px_var(--on-media-shadow)] md:h-28 lg:h-32"
            draggable={false}
          />
        ) : (
          <motion.h1
            variants={itemVariants}
            // Le grand titre de la refonte : plus gros et plus gras que `.titre-banniere` (qui garde
            // la police et le crénage), posé APRÈS elle — un utilitaire l'emporte sur la classe.
            className="titre-banniere mb-4 text-[clamp(2.25rem,4.6vw,4.25rem)] font-[780] leading-[0.98] text-on-media-primary drop-shadow-[0_3px_12px_var(--on-media-shadow)] line-clamp-2 break-words"
          >
            {displayName}
          </motion.h1>
        )}

        <motion.div variants={itemVariants} className="mb-3.5">
          <HeroMetaLine item={item} quality={quality} runtime={runtime} showQuality={!isEpisode} />
        </motion.div>

        {item.Overview && (
          /* DEUX éléments, et c'est indispensable : `line-clamp` impose
             `display: -webkit-box`, que le `sm:block` du même élément écrasait
             dès 640 px de large — le synopsis se déroulait alors en entier,
             jusqu'à recouvrir la bannière. Le conteneur décide donc de
             l'affichage (masqué sur mobile, faute de place), le paragraphe du
             seul découpage.
             CINQ lignes au plus, au-delà desquelles le texte est coupé sur une
             ellipse : la bannière ne prétend pas donner le synopsis complet,
             elle en donne assez pour décider — la fiche fait le reste. */
          <motion.div variants={itemVariants} className="mb-6 hidden sm:block">
            <p className="line-clamp-5 text-base leading-relaxed text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)]">
              <RichOverview text={item.Overview} />
            </p>
          </motion.div>
        )}

        {hasProgress && (
          // Ce qui se MESURE porte le dégradé de jauge ; le remplissage est une échelle, jamais une largeur.
          <motion.div variants={itemVariants} className="mb-5 flex max-w-md items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.18)]">
              <div
                className="h-full origin-left rounded-full"
                style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress / 100))})`, background: "var(--gauge-gradient)" }}
              />
            </div>
            <span className="num text-xs font-medium text-on-media-secondary">{Math.round(progress)} %</span>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <HeroActions item={item} onPlay={handlePlay} resuming={hasProgress} episodeCode={episodeCode} imageUrl={imageUrl} />
        </motion.div>
      </motion.div>
    </div>
  );
}
