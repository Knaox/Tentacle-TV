import { memo, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useIsRecoLeaving, useIsWatchlistPending, useJellyfinClient, useRecoMarkerItem, useSendRecoFeedback,
} from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { titleKey } from "@tentacle-tv/shared";
import { CardFrame } from "../cards/CardFrame";
import { CardImage } from "../cards/CardImage";
import { CardMarkerLayer } from "../cards/CardMarkerLayer";
import { POSTER_VW, POSTER_WIDTH } from "../cards/cardSizes";
import { cardWidthStyle } from "../cards/cardWidthStyle";
import { captureDetailOrigin } from "../detail/detailTransition";
import { RecoPosterHoverLayer } from "./RecoPosterHoverLayer";
import { RecoOnDemandLabel } from "./RecoOnDemandLabel";
import { RecoReasonText } from "./RecoReasonText";
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
 * Affiche 2:3 d'une recommandation — la même carte que celles de la
 * bibliothèque (cadre, largeur de rangée, marqueurs, survol), avec ce que la
 * recommandation ajoute :
 *
 *   • AU REPOS, les marqueurs communs (`CardMarkerLayer`, sur le visage
 *     `useRecoMarkerItem`) : la note — la
 *     globale TMDB, et la vôtre dès que vous notez — en bas à gauche, la
 *     pastille d'états en haut à droite ; en haut à gauche, « À la demande »
 *     (hors bibliothèque) et « Découverte » ; sous l'affiche, la RAISON.
 *   • AU SURVOL, `RecoPosterHoverLayer` : voile, étoiles et plateau —
 *     « Lire » discret en tête, « Ne plus me proposer » au bout de la capsule.
 *     MONTÉ au survol, jamais laissé à opacité nulle (règle GPU du dépôt).
 *   • EN PARTANCE (jugée, puis sa rangée lâchée) : elle s'efface avant que
 *     le titre ne quitte la rangée (`.reco-card-leaving`).
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

  const face = useRecoMarkerItem(item);
  const leaving = useIsRecoLeaving(item.key);
  // Hors bibliothèque, « Ma liste » est une mise de côté jusqu'à l'arrivée :
  // aucun cache Jellyfin ne la connaît, la carte la dit elle-même.
  const pending = useIsWatchlistPending(item.jellyfinItemId ? null : titleKey(item.mediaType, item.tmdbId));
  const handleDismiss = () => {
    feedback.mutate({ itemKey: item.key, action: "dismissed" });
    onDismissed?.(item.key);
  };

  return (
    <div
      ref={rootRef}
      className={`group/card relative shrink-0 snap-start${leaving ? " reco-card-leaving" : ""}`}
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
        // L'anneau de focus est dessiné par l'affiche (`CardFrame`), qui se soulève.
        className={`group/focus block w-full text-left outline-none ${openable ? "cursor-pointer" : ""}`}
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

          {/* Coin haut-gauche : « À la demande » (hors bibliothèque — le titre
              s'obtient via Vigie, il n'est pas sur le serveur) puis
              « Découverte ». Blanc/noir constant et dégradé de marque : posés
              sur média. Au survol d'un titre en bibliothèque, les puces
              qualité/langues montent à cette place : les badges s'effacent
              (opacité seule). */}
          {(!item.jellyfinItemId || item.exploration) && (
            <div
              className={`pointer-events-none absolute left-2 top-2 z-10 flex flex-col items-start gap-1 transition-opacity duration-150 ${
                hovered && item.jellyfinItemId ? "opacity-0" : "opacity-100"
              }`}
            >
              {!item.jellyfinItemId && (
                <span className="rounded-md border border-white/30 bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  <RecoOnDemandLabel item={item} />
                </span>
              )}
              {item.exploration && (
                <span className="rounded-md bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cta-brand-fg">
                  {t("explorationBadge")}
                </span>
              )}
            </div>
          )}

          {/* Marqueurs du repos — les formes de toutes les cartes. Le plateau
              du survol les reprend : ils cèdent la place. */}
          <CardMarkerLayer
            item={face}
            communityRating={item.voteAverage}
            hideRating={hovered}
            hideStatus={hovered}
            inWatchlist={item.jellyfinItemId ? undefined : pending}
          />

          {overlayMounted && (
            <RecoPosterHoverLayer
              item={item}
              visible={hovered}
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
          {/* Pourquoi ce titre est là — lisible sans survoler. */}
          <div className="mt-0.5">
            <RecoReasonText reasons={item.reasons} />
          </div>
        </div>
      </div>
    </div>
  );
});
