import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { HoverRatingStars } from "../rating/HoverRatingStars";
import { RecoReasonText } from "./RecoReasonText";
import { RecoCardPlayButton } from "./RecoCardPlayButton";
import { useRecoPlayTarget } from "./useRecoPlayTarget";

interface RecoCardHoverLayerProps {
  item: RecoRowItem;
  /** Cible du fondu `.hover-reveal` : vrai au survol, faux le temps du sursis de démontage. */
  shown: boolean;
  onDismiss: (e: MouseEvent) => void;
  /** Ouverture de la fiche AVEC sa transition (le `handleOpen` de la carte) — repli du bouton Lecture. */
  onOpenDetail: () => void;
}

/**
 * Tout ce qu'une carte de recommandation ne montre qu'au survol — et tout ce
 * qui s'abonne au cache pour le montrer. Le composant n'est MONTÉ que pendant
 * le survol (`useMountWhile` chez l'appelant) : c'est la règle de
 * `HoverRatingStars`, étendue à tout le calque — au repos, aucune carte ne
 * porte d'abonnement. Voile en dégradé opaque, jamais de backdrop-filter ;
 * les deux fondus viennent de `.hover-reveal`.
 */
export function RecoCardHoverLayer({ item, shown, onDismiss, onOpenDetail }: RecoCardHoverLayerProps) {
  const { t } = useTranslation("reco");
  // Lecture (reprise, sinon l'épisode à suivre) : résolue ici, au survol
  // seulement — et seulement pour un titre en bibliothèque (null sinon).
  const target = useRecoPlayTarget(item.jellyfinItemId, item.mediaType);
  // La racine de la carte réagit à Entrée/Espace pour ouvrir la fiche : une
  // touche pressée sur un bouton du voile (focalisé par le clic) déclencherait
  // son `click` ET remonterait jusqu'à elle — deux navigations. On coupe ici.
  const stopKeys = (e: KeyboardEvent) => e.stopPropagation();
  const ratingIdentity = {
    mediaType: item.mediaType === "tv" ? ("series" as const) : ("movie" as const),
    tmdbId: item.tmdbId,
  };

  return (
    <div
      className="hover-reveal absolute inset-x-0 bottom-0 z-20"
      data-shown={shown}
      onKeyDown={stopKeys}
      style={{
        pointerEvents: shown ? "auto" : "none",
        "--reveal-ms": "180ms",
      } as CSSProperties}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-full"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 30%, rgba(0,0,0,0.55) 70%, transparent)" }}
      />
      <div className="relative flex flex-col gap-1.5 px-2.5 pb-2.5 pt-6">
        <RecoReasonText reasons={item.reasons} />
        {target && <RecoCardPlayButton target={target} onOpenDetail={onOpenDetail} />}
        <HoverRatingStars identity={ratingIdentity} jellyfinItemId={item.jellyfinItemId} />
        <button
          type="button"
          onClick={onDismiss}
          className="self-end rounded-full border border-white/30 px-2 py-0.5 text-[11px] text-white/90 transition-colors hover:border-white hover:text-white"
        >
          {t("dismissAction")}
        </button>
      </div>
    </div>
  );
}
