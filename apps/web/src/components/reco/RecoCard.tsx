import { memo, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useSendRecoFeedback } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { CardFrame } from "../cards/CardFrame";
import { CardImage } from "../cards/CardImage";
import { CardRatingBadge } from "../cards/CardRatingBadge";
import { POSTER_VW, POSTER_WIDTH } from "../cards/cardSizes";
import { cardWidthStyle } from "../cards/cardWidthStyle";
import { captureDetailOrigin } from "../detail/detailTransition";
import { RecoCardHoverLayer } from "./RecoCardHoverLayer";
import { useRecoNavigation } from "../../lib/recoNavigation";
import { recoPosterUrl } from "@tentacle-tv/api-client";
import { useMountWhile } from "../../hooks/useMountWhile";
import { useHoverGuard } from "../../hooks/useHoverGuard";

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
 * demande » pour un titre hors bibliothèque, et un calque de survol (raison de
 * la présence, bouton Lecture d'un titre en bibliothèque, étoiles, « ne plus me
 * proposer » — cf. RecoCardHoverLayer) MONTÉ au survol, jamais laissé à opacité
 * nulle (règle GPU du dépôt).
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
  const rootRef = useRef<HTMLDivElement>(null);
  // La rangée défile sous un curseur immobile : la carte resterait « survolée »,
  // boutons cliquables compris, sur une affiche qui n'est plus sous la souris
  // (cf. useHoverGuard). `onHoverIndex` est stable, donc `unhover` aussi.
  const unhover = useCallback(() => {
    setHovered(false);
    onHoverIndex?.(null);
  }, [onHoverIndex]);
  useHoverGuard(rootRef, hovered, unhover);
  const { open, canOpen } = useRecoNavigation();
  const feedback = useSendRecoFeedback();

  const posterUrl = recoPosterUrl(item, (id) =>
    client.getImageUrl(id, "Primary", { height: 450, quality: 90 })
  );
  const openable = canOpen(item);

  // Un titre en bibliothèque ouvre sa fiche : le rectangle de l'AFFICHE est
  // capturé ici, dernier instant où il existe — même trajet que PosterCard,
  // sans quoi la fiche joue son entrée par-dessus un écran encore noir. Hors
  // bibliothèque, la fiche Vigie vit dans une iframe : rien à déposer.
  const handleOpen = () => {
    if (!openable) return;
    if (item.jellyfinItemId && posterUrl) {
      captureDetailOrigin(
        rootRef.current?.querySelector<HTMLElement>("[data-card-visual]") ?? null,
        item.jellyfinItemId,
        posterUrl
      );
    }
    open(item);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    feedback.mutate({ itemKey: item.key, action: "dismissed" });
    onDismissed?.(item.key);
  };

  return (
    <div
      ref={rootRef}
      className="group/card relative shrink-0 snap-start"
      style={{
        width: cardWidthStyle(width, POSTER_WIDTH.md, POSTER_VW),
        // La carte soulevée passe devant sa voisine — son ombre aussi (cf. CardFrame).
        zIndex: hovered ? 2 : undefined,
        animation: entranceDelay == null ? undefined : "fadeSlideUp 0.34s ease both",
        animationDelay: entranceDelay == null ? undefined : `${entranceDelay}ms`,
      }}
      onMouseEnter={() => {
        setHovered(true);
        onHoverIndex?.(index);
      }}
      onMouseLeave={unhover}
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
          {/* « Découverte » cède la bande du haut aux chips qualité/langues
              pendant le survol d'un titre en bibliothèque — le voile porte de
              toute façon la raison « Exploration ». Sans backdrop-filter, un
              fondu d'opacité suffit. */}
          {item.exploration && (
            <div
              className={`absolute right-2 top-2 z-10 rounded-md bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cta-brand-fg transition-opacity duration-150 ${
                hovered && item.jellyfinItemId ? "opacity-0" : "opacity-100"
              }`}
            >
              {t("explorationBadge")}
            </div>
          )}

          {/* Note globale, TOUJOURS visible : au survol elle passe au-dessus du
              voile, dont la dernière rangée lui laisse le coin (refus à droite). */}
          <CardRatingBadge rating={item.voteAverage} raised />

          {/* Calque de survol — monté au survol seulement, deux fondus via
              .hover-reveal (cf. RecoCardHoverLayer). */}
          {overlayMounted && (
            <RecoCardHoverLayer
              item={item}
              shown={hovered}
              onDismiss={handleDismiss}
              onOpenDetail={handleOpen}
            />
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
