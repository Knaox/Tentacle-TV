import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useDeleteRating,
  useItemRating,
  useJellyfinClient,
  useRateItem,
  useSendRecoFeedback,
} from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { CardFrame } from "../cards/CardFrame";
import { CardImage } from "../cards/CardImage";
import { CardRatingBadge } from "../cards/CardRatingBadge";
import { POSTER_VW, POSTER_WIDTH } from "../cards/cardSizes";
import { cardWidthStyle } from "../cards/cardWidthStyle";
import { StarRating } from "../rating/StarRating";
import { RecoReasonText } from "./RecoReasonText";
import { useRecoNavigation } from "../../lib/recoNavigation";
import { recoPosterUrl } from "./recoImages";
import { useMountWhile } from "../../hooks/useMountWhile";

interface RecoCardProps {
  item: RecoRowItem;
  index: number;
  width?: number | null;
  entranceDelay?: number | null;
  onHoverIndex?: (index: number | null) => void;
  onDismissed?: (itemKey: string) => void;
}

/**
 * Affiche 2:3 d'une recommandation. Même géométrie que PosterCard (largeur de
 * rangée imposée, cadre partagé), mais un contenu différent : badge « à la
 * demande » pour un titre hors bibliothèque, raison de la présence, étoiles et
 * « ne plus me proposer » révélés au survol — MONTÉS au survol, jamais laissés
 * à opacité nulle (règle GPU du dépôt). Aucun backdrop-filter : le voile de
 * survol est un dégradé opaque.
 */
export const RecoCard = memo(function RecoCard({
  item,
  index,
  width,
  entranceDelay,
  onHoverIndex,
  onDismissed,
}: RecoCardProps) {
  const { t } = useTranslation("reco");
  const client = useJellyfinClient();
  const [hovered, setHovered] = useState(false);
  const overlayMounted = useMountWhile(hovered, 200);
  const { open, canOpen } = useRecoNavigation();
  const feedback = useSendRecoFeedback();

  const ratingIdentity = {
    mediaType: item.mediaType === "tv" ? ("series" as const) : ("movie" as const),
    tmdbId: item.tmdbId,
  };
  const rating = useItemRating(hovered ? ratingIdentity : null);
  const rate = useRateItem();
  const removeRating = useDeleteRating();

  const posterUrl = recoPosterUrl(item, (id) =>
    client.getImageUrl(id, "Primary", { height: 450, quality: 90 })
  );
  const openable = canOpen(item);

  const handleOpen = () => {
    if (openable) open(item);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    feedback.mutate({ itemKey: item.key, action: "dismissed" });
    onDismissed?.(item.key);
  };

  return (
    <div
      className="group/card relative shrink-0 snap-start"
      style={{
        width: cardWidthStyle(width, POSTER_WIDTH.md, POSTER_VW),
        animation: entranceDelay == null ? undefined : "fadeSlideUp 0.34s ease both",
        animationDelay: entranceDelay == null ? undefined : `${entranceDelay}ms`,
      }}
      onMouseEnter={() => {
        setHovered(true);
        onHoverIndex?.(index);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onHoverIndex?.(null);
      }}
    >
      {/* div-bouton et non <button> : le voile porte étoiles et refus, et un
          bouton dans un bouton est du HTML invalide (comportements erratiques). */}
      <div
        role="button"
        tabIndex={openable ? 0 : -1}
        aria-disabled={!openable}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
        className={`block w-full text-left ${openable ? "cursor-pointer" : ""}`}
        aria-label={item.title}
      >
        <CardFrame hovered={hovered && openable} aspect="aspect-[2/3]">
          {posterUrl ? (
            <CardImage src={posterUrl} alt={item.title} />
          ) : (
            <div className="flex h-full items-center justify-center bg-fill-soft p-3 text-center text-sm text-content-tertiary">
              {item.title}
            </div>
          )}

          {/* Badge hors bibliothèque — la distinction visuelle exigée : ce
              titre s'obtient à la demande via Vigie, il n'est pas sur le
              serveur. Blanc/noir constant : posé sur média. */}
          {!item.jellyfinItemId && (
            <div className="absolute left-2 top-2 z-10 rounded-md border border-white/30 bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {t("onDemandBadge")}
            </div>
          )}
          {item.exploration && (
            <div className="absolute right-2 top-2 z-10 rounded-md bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cta-brand-fg">
              {t("explorationBadge")}
            </div>
          )}

          {/* Note globale, au repos — le voile de survol couvre le bas. */}
          <CardRatingBadge rating={item.voteAverage} shown={!hovered} />

          {/* Voile de survol : raison + étoiles + refus. Dégradé opaque, pas de
              backdrop-filter. Monté au survol, deux fondus via .hover-reveal. */}
          {overlayMounted && (
            <div
              className="hover-reveal absolute inset-x-0 bottom-0 z-20"
              data-shown={hovered}
              style={{
                pointerEvents: hovered ? "auto" : "none",
                "--reveal-ms": "180ms",
              } as React.CSSProperties}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-full"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 30%, rgba(0,0,0,0.55) 70%, transparent)" }}
              />
              <div className="relative flex flex-col gap-1.5 px-2.5 pb-2.5 pt-6">
                <RecoReasonText reasons={item.reasons} />
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <StarRating
                    size="sm"
                    value={rating?.score ?? null}
                    onRate={(score) => rate.mutate({ ...ratingIdentity, score })}
                    onClear={() => removeRating.mutate(ratingIdentity)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="self-start rounded-full border border-white/30 px-2 py-0.5 text-[11px] text-white/90 transition-colors hover:border-white hover:text-white"
                >
                  {t("dismissAction")}
                </button>
              </div>
            </div>
          )}
        </CardFrame>

        {/* Bloc titre sous l'affiche — même gabarit que les rangées d'accueil. */}
        <div className="mt-2 min-h-[40px]">
          <p className="line-clamp-1 text-sm font-medium text-content-primary">{item.title}</p>
          <p className="text-xs text-content-tertiary">
            {item.year ?? ""}
            {!openable && ` — ${t("unavailableHint")}`}
          </p>
        </div>
      </div>
    </div>
  );
});
