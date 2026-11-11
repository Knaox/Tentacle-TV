import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { extractMediaQuality, formatDuration, formatEpisodeCode, type MediaItem } from "@tentacle-tv/shared";
import { localMediaItem, localVersionOf, watchStateOf, type DownloadListEntry } from "@tentacle-tv/offline-core";
import { HeroEyebrow } from "../../components/hero/HeroEyebrow";
import { HeroMetaLine } from "../../components/hero/HeroMetaLine";
import { HERO_INFO_PROPS, HERO_PLAY_PROPS } from "../../components/hero/HeroActions";
import { InfoIcon, PlayIcon } from "../../components/icons/HeroIcons";
import { soberMetaText } from "../../components/media/MetaChips";
import { PressableGlass } from "../../components/ui/glass/PressableGlass";
import { RichOverview } from "../../lib/overviewHtml";
import { fadeIn, slideText } from "../../theme/motion";
import { lastInputWasKeyboard } from "../../lib/inputModality";
import { useDownloadsRootReady } from "../localFiles";
import { useLocalSnapshot } from "../useLocalSnapshot";
import { useFirstLocalImage } from "../detail/useFirstLocalImage";
import { versionLabel } from "../detail/offlineDetailText";

const LOGO = ["logo.png"] as const;

/**
 * Le texte et les actions d'une diapositive locale — le jumeau de
 * `HeroContent`, mêmes classes et même cascade : sur-titre (Continuer, le
 * code de l'épisode, ou « Sur cet appareil » avec la version gardée), logo du
 * snapshot sinon le titre, ligne de faits (qualité du FICHIER), synopsis,
 * avancement sur la jauge du socle, puis Reprendre / Lecture et Plus d'infos,
 * qui ouvre la fiche locale.
 *
 * Posé sur les voiles noirs constants de la bannière : jetons `on-media` dans
 * les deux thèmes. `key={animationKey}` refait fondre le texte, d'un bloc, à chaque diapositive.
 */
export function OfflineBillboardContent({ entry, animationKey }: { entry: DownloadListEntry; animationKey: number }) {
  const { t } = useTranslation(["common", "downloads"]);
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const rootReady = useDownloadsRootReady();
  const snapshot = useLocalSnapshot<MediaItem>(entry.itemId, "item.json", rootReady);
  const item = useMemo(() => localMediaItem(snapshot, entry), [snapshot, entry]);
  const logo = useFirstLocalImage(entry.itemId, LOGO);
  const quality = useMemo(() => extractMediaQuality(item), [item]);

  const isEpisode = entry.kind === "episode";
  const displayName = isEpisode ? (entry.seriesName ?? item.SeriesName ?? item.Name) : item.Name;
  const code = isEpisode && entry.parentIndexNumber != null && entry.indexNumber != null
    ? formatEpisodeCode(entry.parentIndexNumber, entry.indexNumber)
    : null;
  const percent = watchStateOf(entry).percent ?? 0;
  const hasProgress = percent > 0 && percent < 100;
  const version = versionLabel(t, localVersionOf(entry));
  const eyebrowLabel = hasProgress ? t("common:continueLabel") : isEpisode ? (code ?? displayName) : t("downloads:heroLabel");
  const eyebrowHint = [isEpisode ? soberMetaText(quality) : null, version].filter(Boolean).join(" · ") || undefined;

  const groupVariants = reduced ? undefined : slideText;
  const itemVariants = reduced ? undefined : fadeIn;

  return (
    <div className="absolute inset-x-0 bottom-6 z-10 pl-16 pr-4 sm:pr-8 md:bottom-10 md:pl-20 md:pr-12">
      {/* Passée au clavier (← →), la diapositive est là d'emblée : une touche ne s'anime pas. */}
      <motion.div key={animationKey} className="max-w-xl" variants={groupVariants} initial={lastInputWasKeyboard() ? false : "hidden"} animate="show">
        <motion.div variants={itemVariants} className="mb-3.5">
          <HeroEyebrow label={eyebrowLabel} hint={eyebrowHint} />
        </motion.div>

        {logo.url ? (
          <motion.img
            variants={itemVariants}
            src={logo.url}
            alt={displayName}
            className="mb-4 h-20 max-w-[440px] object-contain object-left drop-shadow-[0_4px_24px_var(--on-media-shadow)] md:h-28 lg:h-32"
            draggable={false}
          />
        ) : (
          <motion.h2
            variants={itemVariants}
            className={`titre-banniere mb-4 line-clamp-2 break-words font-bold text-on-media-primary drop-shadow-[0_3px_12px_var(--on-media-shadow)] ${logo.settled || !rootReady ? "" : "invisible"}`}
          >
            {displayName}
          </motion.h2>
        )}

        <motion.div variants={itemVariants} className="mb-3.5">
          <HeroMetaLine item={item} quality={quality} runtime={formatDuration(item.RunTimeTicks)} showQuality={!isEpisode} />
        </motion.div>

        {item.Overview && (
          <motion.div variants={itemVariants} className="mb-6 hidden sm:block">
            <p className="line-clamp-5 text-base leading-relaxed text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)]">
              <RichOverview text={item.Overview} />
            </p>
          </motion.div>
        )}

        {hasProgress && (
          <motion.div variants={itemVariants} className="mb-5 flex max-w-md items-center gap-3">
            {/* La jauge du socle, posée sur l'image : `scaleX`, jamais une largeur ; plus de lueur. */}
            <div className="gauge flex-1" style={{ backgroundColor: "var(--on-media-muted)" }}>
              <i style={{ transform: `scaleX(${percent / 100})` }} />
            </div>
            <span className="text-xs font-medium tabular-nums text-on-media-secondary">{Math.round(percent)}%</span>
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-2.5">
          <PressableGlass {...HERO_PLAY_PROPS} onClick={() => navigate(`/watch/${entry.itemId}`)}>
            <PlayIcon />
            {hasProgress ? t("common:resume") : t("common:play")}
            {code && <span className="font-semibold opacity-60">{code}</span>}
          </PressableGlass>
          <PressableGlass {...HERO_INFO_PROPS} onClick={() => navigate(`/offline/item/${entry.itemId}`)}>
            <InfoIcon />
            {t("common:moreInfo")}
          </PressableGlass>
        </motion.div>
      </motion.div>
    </div>
  );
}
