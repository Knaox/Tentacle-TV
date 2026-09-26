import { useTranslation } from "react-i18next";
import { Compass, Info, Sparkles, Star } from "lucide-react";
import {
  recoAmbilightSourceUrl,
  recoBackdropUrl,
  recoHaloSourceUrl,
  recoPosterUrl,
  type RecoRowItem,
} from "@tentacle-tv/api-client";
import { CascadeGroup } from "../../hero/CascadeGroup";
import { HeroEyebrow } from "../../hero/HeroEyebrow";
import { HERO_CTA_ROW, TEXT_SHADOW, TITLE_SHADOW, heroPlayClass } from "../../hero/heroCta";
import { HALO_SOURCE_WIDTH, type HeroImageClient, type HeroSlide } from "../../hero/heroSlides";
import { useIsTablet } from "../../useMirrorLayout";
import { firstReasonText } from "./recoReasons";

/**
 * `RecoHeroContent` de l'app : sur-titre « Sélectionné pour vous », titre 32
 * (46 sur tablette), année, note à l'étoile de MARQUE (rose), badge « À la
 * demande », la première raison en pastille violette, et le bouton qui ouvre
 * la fiche (Jellyfin) ou le catalogue (Vigie) — absent sans destination.
 */
export function RecoHeroContent({ item, active, canOpen, onOpen }: {
  item: RecoRowItem;
  active: boolean;
  canOpen: boolean;
  onOpen: (item: RecoRowItem) => void;
}) {
  const { t } = useTranslation("reco");
  const isTablet = useIsTablet();
  const onDemand = item.jellyfinItemId === null;
  const reason = firstReasonText(item.reasons, t);
  const ctaLabel = onDemand ? t("heroOpenVigie") : t("heroOpenDetail");
  const CtaIcon = onDemand ? Compass : Info;

  return (
    <div>
      <CascadeGroup order={0} active={active}>
        <div className="mb-2.5">
          <HeroEyebrow label={t("heroForYou")} />
        </div>
        <h2
          className="line-clamp-2 font-extrabold text-on-media-primary"
          style={{
            fontSize: isTablet ? 46 : 32,
            lineHeight: isTablet ? "52px" : "36px",
            marginBottom: isTablet ? 16 : 12,
            letterSpacing: -0.6,
            textShadow: TITLE_SHADOW,
          }}
        >
          {item.title}
        </h2>
      </CascadeGroup>

      <CascadeGroup order={1} active={active}>
        <div className="mb-2.5 flex flex-wrap items-center gap-[9px] text-[13px] font-semibold">
          {item.year != null && <span className="text-on-media-secondary">{item.year}</span>}
          {item.voteAverage != null && item.voteAverage > 0 && (
            <span className="flex items-center gap-1 text-on-media-primary">
              <Star size={12} className="text-[var(--brand-accent)]" fill="currentColor" aria-hidden />
              {item.voteAverage.toFixed(1)}
            </span>
          )}
          {onDemand && (
            <span className="rounded-full border-[0.5px] border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.65)] px-2.5 py-[3.5px] text-[10px] font-bold uppercase leading-3 tracking-[0.3px] text-on-media-primary">
              {t("onDemandBadge")}
            </span>
          )}
        </div>
        {reason && (
          <div
            className="mb-[18px] flex max-w-full items-center gap-1.5 self-start rounded-full border px-3 py-[5px]"
            style={{ width: "fit-content", borderColor: "rgba(var(--brand-rgb), 0.5)", background: "rgba(var(--brand-rgb), 0.24)" }}
          >
            <Sparkles size={12} className="shrink-0 text-[var(--brand-accent-light)]" aria-hidden />
            <span
              className={`line-clamp-2 font-medium text-on-media-primary ${isTablet ? "text-sm leading-[19px]" : "text-[11px] leading-[17px]"}`}
              style={{ textShadow: TEXT_SHADOW }}
            >
              {reason}
            </span>
          </div>
        )}
      </CascadeGroup>

      <CascadeGroup order={2} active={active}>
        {canOpen && (
          <div className={HERO_CTA_ROW}>
            <button type="button" onClick={() => onOpen(item)} className={heroPlayClass(isTablet)} aria-label={`${ctaLabel} ${item.title}`}>
              <CtaIcon size={18} aria-hidden />
              {ctaLabel}
            </button>
          </div>
        )}
      </CascadeGroup>
    </div>
  );
}

/**
 * `recoHeroSlides` de l'app : visuel large TMDB (sinon le backdrop Jellyfin),
 * halo depuis la même image en petit ; en carte portrait, l'affiche (Jellyfin
 * en bibliothèque, TMDB `w780` sinon).
 */
export function recoHeroSlides(
  items: readonly RecoRowItem[],
  client: HeroImageClient,
  handlers: { canOpen: (item: RecoRowItem) => boolean; onOpen: (item: RecoRowItem) => void },
): HeroSlide[] {
  return items.map((item) => ({
    id: item.key,
    backdropUri: recoBackdropUrl(item, (id) => client.getImageUrl(id, "Backdrop", { width: 1280, quality: 85 })),
    haloUri: recoAmbilightSourceUrl(item, (id) => client.getImageUrl(id, "Backdrop", { width: HALO_SOURCE_WIDTH, quality: 70 })),
    posterUri: recoPosterUrl(item, (id) => client.getImageUrl(id, "Primary", { width: 1080, quality: 85 }), "w780"),
    haloPosterUri: recoHaloSourceUrl(item, (id) => client.getImageUrl(id, "Primary", { width: HALO_SOURCE_WIDTH, quality: 70 })),
    render: (active) => <RecoHeroContent item={item} active={active} canOpen={handlers.canOpen(item)} onOpen={handlers.onOpen} />,
  }));
}
