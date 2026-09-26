import { useMemo, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { reasonToText, useJellyfinClient, useSendRecoFeedback } from "@tentacle-tv/api-client";
import { captureDetailOrigin } from "@/components/detail/detailTransition";
import { HeroEyebrow } from "@/components/hero/HeroEyebrow";
import { StarIcon } from "@/components/icons/HeroIcons";
import { recoHeroBackdropUrl } from "@/components/reco/hero/RecoHeroBackdrop";
import { useRecoNavigation } from "@/lib/recoNavigation";
import type { RecoRowItem } from "@tentacle-tv/api-client";

interface RecoHeroContentProps {
  item: RecoRowItem;
  /** Rejoue la cascade d'entrée sur le web ; sans objet ici (cf. plus bas). */
  animationKey: number;
}

/**
 * Le texte et les actions d'une diapositive « Sélectionné pour vous », sans
 * notation.
 *
 * Même rendu que celui du web — sur-titre, titre, année et note TMDB, pastille
 * de la raison, « Voir la fiche » et « Ne plus me proposer » — moins deux
 * choses que le téléviseur n'a pas :
 *
 *  - **« Votre note » et ses étoiles** : dix demi-étoiles à traverser au D-pad,
 *    un anneau qui débordait de glyphes de vingt pixels (`shims/noRating.ts`).
 *    Les trois requêtes de note par diapositive partent avec elles ;
 *  - **la pastille « À la demande »** : seuls des titres de la bibliothèque
 *    arrivent jusqu'ici (`RecoBillboardSlotTv.tsx`).
 *
 * Pas de clé de remontage non plus : sur le web, elle rejoue une cascade que
 * le shim de framer-motion ne joue pas, et elle démontait le bouton focalisé à
 * chaque rotation — le focus retombait sur le document.
 */
export function RecoHeroContent({ item }: RecoHeroContentProps) {
  const { t } = useTranslation("reco");
  const { open, canOpen } = useRecoNavigation();
  const feedback = useSendRecoFeedback();
  const client = useJellyfinClient();

  // Le cadre vole jusqu'à la fiche, comme depuis la bannière d'accueil.
  const openDetail = (event: MouseEvent<HTMLButtonElement>) => {
    if (item.jellyfinItemId) {
      const frame = event.currentTarget.closest<HTMLElement>("[data-hero-frame]");
      const url = recoHeroBackdropUrl(client, item);
      if (frame && url) {
        const radius = parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0;
        captureDetailOrigin(frame, item.jellyfinItemId, url, radius);
      }
    }
    open(item);
  };

  const reasonText = useMemo(() => {
    for (const reason of item.reasons) {
      const text = reasonToText(reason, t);
      if (text) return text;
    }
    return null;
  }, [item.reasons, t]);

  return (
    <div className="absolute inset-x-0 bottom-[15%] z-10 px-4 sm:px-8 md:bottom-[18%] md:px-14 lg:bottom-[20%]">
      <div className="max-w-xl">
        <div className="mb-3.5">
          <HeroEyebrow label={t("heroForYou")} />
        </div>

        <h1 className="titre-banniere mb-3.5 font-bold text-on-media-primary drop-shadow-[0_3px_12px_var(--on-media-shadow)] line-clamp-2 break-words">
          {item.title}
        </h1>

        {/* Le dernier bloc avant les boutons garde l'écart que la ligne
            « Votre note » ménageait sur le web. */}
        <div
          className={`${reasonText ? "mb-3.5" : "mb-6"} flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-on-media-secondary`}
        >
          {item.year != null && <span>{item.year}</span>}
          {item.voteAverage != null && (
            <span className="flex items-center gap-1 font-semibold text-on-media-primary">
              <span aria-hidden className="text-[var(--brand-accent)]">
                <StarIcon />
              </span>
              {item.voteAverage.toFixed(1)}
            </span>
          )}
        </div>

        {reasonText && (
          <div className="mb-6">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[rgba(var(--brand-rgb),0.5)] bg-[rgba(var(--brand-rgb),0.24)] px-3 py-1 text-xs font-medium text-on-media-primary drop-shadow-[0_1px_4px_var(--on-media-shadow)]">
              <Sparkles size={12} aria-hidden className="shrink-0 text-[var(--brand-accent-light)]" />
              {reasonText}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          {canOpen(item) && (
            <button
              type="button"
              onClick={openDetail}
              className="rounded-full border border-cta-primary-border bg-cta-primary-bg px-6 py-2.5 font-bold text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover"
              style={{ boxShadow: "var(--elev-2)" }}
            >
              {t("heroOpenDetail")}
            </button>
          )}
          <button
            type="button"
            onClick={() => feedback.mutate({ itemKey: item.key, action: "dismissed" })}
            className="rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.42)] px-4 py-2 text-sm text-on-media-primary transition-colors hover:bg-[rgba(var(--scrim-media-rgb),0.62)]"
          >
            {t("dismissAction")}
          </button>
        </div>
      </div>
    </div>
  );
}
