import { memo, useCallback, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  recoAmbilightSourceUrl, recoItemReasonText, recoSpotlightOf, useHeldRecoItems, useJellyfinClient, useMediaItem,
  useSendRecoFeedback, type RecoPage, type RecoRowItem,
} from "@tentacle-tv/api-client";
import { AmbilightLayer } from "../../hero/AmbilightLayer";
import { CARD_HEIGHT, FRAME_GUTTER } from "../../hero/HeroBillboard";
import { captureDetailOrigin } from "../../detail/detailTransition";
import { useHoverMount } from "../../../hooks/useHoverMount";
import { useInViewport } from "../../../hooks/useInViewport";
import { useRecoNavigation } from "../../../lib/recoNavigation";
import { RecoHeroBackdrop, recoHeroBackdropUrl } from "../hero/RecoHeroBackdrop";
import { SpotlightAlternatives } from "./SpotlightAlternatives";
import { SpotlightContent } from "./SpotlightContent";

/**
 * « À la une ce soir » — LE titre à regarder, en cinq secondes : le meilleur
 * pari du moteur (`featured`, sinon la tête classée de « Pour vous »), sa
 * raison en une phrase, sa correspondance, et de quoi le lancer tout de suite ;
 * à côté, les quatre suivants (« Ou bien »), pour qui hésite.
 *
 * Calme par construction : pas de carrousel qui tourne seul. Le fond ne
 * change qu'au geste (un titre choisi dans « Ou bien »). Survolée, la une
 * TIENT ses titres (`useHeldRecoItems`, règle 2) : un titre mis dans Ma liste
 * ici n'en sort qu'au lâcher ; « Ne plus me proposer » part tout de suite,
 * et la suivante prend la place.
 *
 * Coût : une seule fiche Jellyfin lue (le titre à la une — durée, genres,
 * synopsis, bande-annonce ; le cache de la fiche, qu'ouvrir la fiche réutilise),
 * le halo démonté hors écran, aucune animation au repos.
 */
export const RecoSpotlight = memo(function RecoSpotlight({ page }: { page: RecoPage }) {
  const { t, i18n } = useTranslation("reco");
  const client = useJellyfinClient();
  const { open } = useRecoNavigation();
  const feedback = useSendRecoFeedback();
  const { ref: frameRef, visible } = useInViewport<HTMLDivElement>("200px");
  const hover = useHoverMount(300);

  const { featured, alternatives } = useMemo(() => recoSpotlightOf(page), [page]);
  const served = useMemo(() => (featured ? [featured, ...alternatives] : []), [featured, alternatives]);
  const choices = useHeldRecoItems(served, hover.hovered);
  const [picked, setPicked] = useState<string | null>(null);
  const item = choices.find((choice) => choice.key === picked) ?? choices[0];
  const { data: media } = useMediaItem(item?.jellyfinItemId ?? undefined);

  const reasonOf = useCallback(
    (choice: RecoRowItem) => recoItemReasonText(choice, t, { locale: i18n.language }),
    [t, i18n.language],
  );

  const openDetail = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (!item) return;
      if (item.jellyfinItemId) {
        const frame = e.currentTarget.closest<HTMLElement>("[data-hero-frame]");
        const url = recoHeroBackdropUrl(client, item);
        if (frame && url) {
          const radius = parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0;
          captureDetailOrigin(frame, item.jellyfinItemId, url, radius);
        }
      }
      open(item);
    },
    [item, client, open],
  );
  const dismiss = useCallback(() => {
    if (item) feedback.mutate({ itemKey: item.key, action: "dismissed" });
  }, [item, feedback]);

  if (!item) return null;
  const haloUrl = recoAmbilightSourceUrl(item, (id) => client.getImageUrl(id, "Backdrop", { width: 128, quality: 70 }));

  return (
    <section className={`relative w-full bg-surface-0 pb-6 pt-6 md:pb-10 ${FRAME_GUTTER}`} aria-label={t("spotlightRegionAria")}>
      <div ref={frameRef} className="relative">
        {visible && <AmbilightLayer url={haloUrl} layerKey={item.key} />}
        <div
          data-hero-frame
          className={`relative w-full overflow-hidden ${CARD_HEIGHT}`}
          style={{ borderRadius: "var(--hero-frame-radius)", boxShadow: "var(--hero-frame-ring)" }}
          onMouseEnter={hover.onMouseEnter}
          onMouseLeave={hover.onMouseLeave}
        >
          <RecoHeroBackdrop item={item} />
          <div className="absolute inset-x-0 bottom-[10%] z-10 flex items-end justify-between gap-8 px-4 sm:px-8 md:bottom-[12%] md:px-14">
            <SpotlightContent
              item={item}
              media={media}
              reason={reasonOf(item)}
              onOpenDetail={openDetail}
              onDismiss={dismiss}
            />
            <SpotlightAlternatives items={choices} selectedKey={item.key} reasonOf={reasonOf} onSelect={setPicked} />
          </div>
        </div>
      </div>
    </section>
  );
});
