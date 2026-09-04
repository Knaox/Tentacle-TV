import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { AmbilightLayer } from "../../hero/AmbilightLayer";
import { HERO_ZOOM_DURATION_S } from "../../hero/HeroBackdrop";
import { CARD_HEIGHT, FRAME_GUTTER } from "../../hero/HeroBillboard";
import { HeroIndicators } from "../../hero/HeroIndicators";
import { useBillboardRotation } from "../../hero/useBillboardRotation";
import { useHoverMount } from "../../../hooks/useHoverMount";
import { useIdle } from "../../../hooks/useIdle";
import { useInViewport } from "../../../hooks/useInViewport";
import { useDataSaverActive } from "../../../offline/useDataSaver";
import { recoAmbilightSourceUrl } from "../recoImages";
import { RecoHeroBackdrop } from "./RecoHeroBackdrop";
import { RecoHeroContent } from "./RecoHeroContent";

/** Mêmes seuils que HeroBillboard — les raisons mesurées vivent là-bas. */
const IDLE_MS = 20_000;
const ROTATE_MS = HERO_ZOOM_DURATION_S * 1000;

/**
 * Carrousel héros des recommandations — coquille jumelle de HeroBillboard
 * (géométrie, gardes et minuterie partagées), adaptée aux RecoRowItem :
 * chaque diapositive porte sa RAISON, la notation rapide et le renvoi
 * fiche/Vigie. Servi par RecoBillboardSlot sur la page Recommandations ET
 * l'accueil en mode héros « reco » — un seul point de vérité.
 *
 * NB : pas de pause au survol — même raison documentée que HeroBillboard :
 * la bannière couvre ~76 vh, le curseur la survole quasi en permanence, un
 * timer en pause figeait le carrousel sur sa première diapositive. Le survol
 * ne sert qu'à MONTER les flèches (backdrop-filter : jamais à opacité nulle).
 */
export function RecoBillboard({ slides }: { slides: RecoRowItem[] }) {
  const { t } = useTranslation("reco");
  const client = useJellyfinClient();
  const dataSaver = useDataSaverActive();
  const { ref: frameRef, visible } = useInViewport<HTMLDivElement>("200px");
  const idle = useIdle(IDLE_MS);
  const arrows = useHoverMount(300);

  const { index, animKey, selectWithGrace, prevWithGrace, nextWithGrace } = useBillboardRotation({
    count: slides.length,
    rotateMs: ROTATE_MS,
    active: !dataSaver && visible && !idle,
  });

  // Le clamp du hook passe par un effet : entre un retrait optimiste (« Ne
  // plus me proposer ») et ce recalage, on borne à la main.
  const item = slides[Math.min(index, slides.length - 1)];
  if (!item) return null;

  const haloUrl = recoAmbilightSourceUrl(item, (id) =>
    client.getImageUrl(id, "Backdrop", { width: 128, quality: 70 })
  );

  return (
    // Le CADRE : fond de page, gouttières de rangée — géométrie de l'accueil
    // au pixel près. Aucun `overflow-hidden` ici : le halo doit déborder.
    <section
      className={`relative w-full bg-surface-0 pb-6 md:pb-10 ${FRAME_GUTTER}`}
      aria-label={t("heroRegionAria")}
    >
      <div ref={frameRef} className="relative">
        {/* Halo démonté hors écran — une image floutée animée en boucle. */}
        {visible && <AmbilightLayer url={haloUrl} layerKey={item.key} />}

        {/* Repère de la transition d'ouverture : c'est ce cadre que « Voir la
            fiche » fait voler jusqu'à la fiche (cf. HeroBillboard). */}
        <div
          data-hero-frame
          className={`group/billboard relative w-full overflow-hidden ${CARD_HEIGHT}`}
          style={{
            borderRadius: "var(--hero-frame-radius)",
            boxShadow: "var(--hero-frame-ring)",
          }}
          onMouseEnter={arrows.onMouseEnter}
          onMouseLeave={arrows.onMouseLeave}
        >
          <RecoHeroBackdrop item={item} />
          <RecoHeroContent item={item} animationKey={animKey} />
          <HeroIndicators
            count={slides.length}
            activeIndex={Math.min(index, slides.length - 1)}
            durationMs={ROTATE_MS}
            arrowsMounted={arrows.mounted}
            arrowsShown={arrows.hovered}
            onSelect={selectWithGrace}
            onPrev={prevWithGrace}
            onNext={nextWithGrace}
          />
        </div>
      </div>
    </section>
  );
}
