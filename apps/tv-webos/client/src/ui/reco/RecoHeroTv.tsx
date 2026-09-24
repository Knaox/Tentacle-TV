import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { reasonToText, useJellyfinClient, useSeriesWatchState, type RecoRowItem } from "@tentacle-tv/api-client";
import { formatDuration, formatEpisodeCode, type MediaItem } from "@tentacle-tv/shared";
import { CARD_HEIGHT, FRAME_GUTTER } from "@/components/hero/HeroBillboard";
import { HeroAmbilight } from "@/components/hero/HeroAmbilight";
import { HeroBackdrop } from "@/components/hero/HeroBackdrop";
import { HeroEyebrow } from "@/components/hero/HeroEyebrow";
import { HeroMetaLine } from "@/components/hero/HeroMetaLine";
import { HeroActions } from "@/components/hero/HeroActions";
import { useInViewport } from "@/hooks/useInViewport";
import { extractMediaQuality } from "@/lib/mediaQuality";
import { firstReasonText } from "./recoMediaItem";

/**
 * La tête de « Pour vous » : le titre que le moteur place le plus haut, s'il
 * est sur le serveur (`tvRecoHero`) — son fond, son titre ou son logo, POURQUOI
 * il est là, et « Lecture » à côté de la fiche.
 *
 * Le cadre, le fond et le halo sont ceux de la bannière d'accueil (mêmes
 * composants, mêmes gabarits, mêmes substitutions du téléviseur) : passer de
 * l'accueil à « Pour vous » ne change pas de langage. Le texte, lui, est celui
 * d'une recommandation : « Notre meilleure suggestion », et la raison. Les
 * boutons sont ceux de l'accueil — « Lecture » y porte `cta-primary`, que le
 * moteur vise en arrivant sur l'écran.
 */
export function RecoHeroTv({ reco, item }: { reco: RecoRowItem; item: MediaItem }) {
  const { t } = useTranslation("reco");
  // Hors écran, le halo — une image floutée — n'a rien à faire monté.
  const { ref: frameRef, visible } = useInViewport<HTMLDivElement>("200px");

  return (
    <section className={`relative w-full pb-6 md:pb-10 ${FRAME_GUTTER}`} aria-label={t("heroRegionAria")}>
      <div ref={frameRef} className="relative">
        {visible && <HeroAmbilight item={item} />}
        <div
          data-hero-frame
          className={`relative w-full overflow-hidden ${CARD_HEIGHT}`}
          style={{ borderRadius: "var(--hero-frame-radius)", boxShadow: "var(--hero-frame-ring)" }}
        >
          <HeroBackdrop items={[item]} activeIndex={0} />
          <RecoHeroContent reco={reco} item={item} />
        </div>
      </div>
    </section>
  );
}

function RecoHeroContent({ reco, item }: { reco: RecoRowItem; item: MediaItem }) {
  const { t } = useTranslation("reco");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const isSeries = item.Type === "Series";
  const { data: watchState } = useSeriesWatchState(isSeries ? item.Id : undefined);

  const reason = useMemo(() => firstReasonText(reco.reasons, (r) => reasonToText(r, t)), [reco.reasons, t]);
  const quality = useMemo(() => extractMediaQuality(item), [item]);
  const logo = item.ImageTags?.Logo ? client.getImageUrl(item.Id, "Logo", { width: 500, quality: 90 }) : null;
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const resuming = progress > 0 && progress < 100;
  const resumeEpisode = isSeries && watchState?.type !== "completed" ? watchState?.episode : undefined;
  const episodeCode = resumeEpisode
    ? formatEpisodeCode(resumeEpisode.ParentIndexNumber, resumeEpisode.IndexNumber)
    : null;

  // Une série se lit par l'épisode à reprendre, sinon s'ouvre sur sa fiche —
  // la règle de la bannière d'accueil.
  const play = () => {
    if (!isSeries) {
      navigate(`/watch/${item.Id}`);
      return;
    }
    const episodeId = watchState?.type !== "completed" ? watchState?.episode?.Id : undefined;
    navigate(episodeId ? `/watch/${episodeId}` : `/media/${item.Id}`);
  };

  return (
    <div className="absolute inset-x-0 bottom-[15%] z-10 px-4 sm:px-8 md:bottom-[18%] md:px-14 lg:bottom-[20%]">
      <div className="max-w-xl">
        <div className="mb-3.5">
          <HeroEyebrow label={t("heroKicker")} />
        </div>
        {logo ? (
          <img
            src={logo}
            alt={item.Name}
            draggable={false}
            className="mb-4 h-20 max-w-[440px] object-contain object-left drop-shadow-[0_4px_24px_var(--on-media-shadow)] md:h-28 lg:h-32"
          />
        ) : (
          <h1 className="titre-banniere mb-4 line-clamp-2 break-words font-bold text-on-media-primary drop-shadow-[0_3px_12px_var(--on-media-shadow)]">
            {item.Name}
          </h1>
        )}
        <div className="mb-3.5">
          <HeroMetaLine item={item} quality={quality} runtime={formatDuration(item.RunTimeTicks)} showQuality />
        </div>
        {reason && (
          <p className="reco-tv-reason">
            <Sparkles className="reco-tv-reason-icon" size={22} aria-hidden />
            <span className="reco-tv-reason-text">{t("tvReason", { reason })}</span>
          </p>
        )}
        <HeroActions item={item} onPlay={play} resuming={resuming} episodeCode={episodeCode} />
      </div>
    </div>
  );
}
