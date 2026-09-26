import { memo, useMemo } from "react";
import { AmbilightLayer } from "../../components/hero/AmbilightLayer";
import { useInViewport } from "../../hooks/useInViewport";
import { useHeroMetrics } from "../useMirrorLayout";
import { HeroBackdropStack } from "./HeroBackdropStack";
import { slideHalo, type HeroSlide } from "./heroSlides";
import { useHeroPager } from "./useHeroPager";
import "./hero.css";

/** Voile du haut (`GradientOverlay` « soft », direction top, noir à 0,65). */
const TOP_SCRIM =
  "linear-gradient(180deg, rgba(var(--scrim-media-rgb), 0.55) 0%, rgba(var(--scrim-media-rgb), 0.26) 35%, rgba(var(--scrim-media-rgb), 0.07) 75%, transparent 100%)";

/**
 * `HeroBanner` de l'app : une CARTE (marges 16, rayon 20, hauteur
 * `min(660 | 820, 0,74 × H)`), l'affiche au lieu du visuel large quand la
 * carte est plus haute que large, le halo ambilight derrière, les voiles du
 * bureau (110 en haut ; 62 %, ou 74 % en portrait, en bas), la rotation de
 * 8 s par glissement horizontal paginé, les points (actif 22 au dégradé de
 * marque, inactifs 6) et le liseré `--hero-frame-ring` par-dessus tout.
 * Chaque diapositive rend son propre texte (padding 28 / 20 / 52, 640 au plus).
 *
 * Rotation, zoom et halo ne vivent que bandeau visible et page au premier plan.
 */
export const HeroBanner = memo(function HeroBanner({ slides }: { slides: HeroSlide[] }) {
  const { bannerH, slideW, margin, radius, portrait } = useHeroMetrics();
  const { ref, visible } = useInViewport<HTMLDivElement>();
  const ids = useMemo(() => slides.map((s) => s.id), [slides]);
  const { scrollerRef, index, handlers } = useHeroPager({ ids, slideW, visible });

  if (!slides.length) return <div style={{ height: bannerH }} />;
  const active = slides[index];
  const haloUri = active ? slideHalo(active, portrait) : null;

  return (
    <div ref={ref} className="relative" style={{ paddingInline: margin }}>
      {/* L'ambilight : l'image active, floutée DERRIÈRE la carte — frère
          précédent, donc peint dessous ; démonté hors écran. */}
      {visible && haloUri && (
        <div className="absolute" style={{ left: margin, right: margin, top: 0, bottom: 0 }}>
          <AmbilightLayer url={haloUri} layerKey={haloUri} />
        </div>
      )}
      <div
        className="relative overflow-hidden bg-surface-0"
        style={{ width: slideW, height: bannerH, borderRadius: radius, isolation: "isolate" }}
      >
        <HeroBackdropStack slides={slides} activeIndex={index} portrait={portrait} playing={visible} />
        {/* L'affiche porte souvent son titre imprimé : un voile uni la recule. */}
        {portrait && <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(var(--scrim-media-rgb), 0.22)" }} />}
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: 110, background: TOP_SCRIM }} />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{ height: bannerH * (portrait ? 0.74 : 0.62), background: "var(--hero-scrim-bottom)" }}
        />

        <div
          ref={scrollerRef}
          {...handlers}
          className="mirror-no-scrollbar mirror-hero-pager absolute inset-0 flex overflow-x-auto overflow-y-hidden"
        >
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              className="flex h-full shrink-0 flex-col justify-end"
              style={{ width: slideW, padding: "28px 20px 52px" }}
            >
              <div className="w-full max-w-[640px]">{slide.render(i === index)}</div>
            </div>
          ))}
        </div>

        {slides.length > 1 && (
          <div
            className="pointer-events-none absolute inset-x-0 flex items-center justify-center gap-[5px]"
            style={{ bottom: bannerH * 0.04 }}
            aria-hidden
          >
            {slides.map((slide, i) =>
              i === index ? (
                <span
                  key={slide.id}
                  className="h-[3px] w-[22px] rounded-sm"
                  style={{
                    background: "linear-gradient(90deg, var(--brand), var(--brand-accent))",
                    boxShadow: "0 0 8px rgba(var(--brand-accent-rgb), 0.7)",
                  }}
                />
              ) : (
                <span key={slide.id} className="h-[3px] w-1.5 rounded-sm bg-content-quaternary" />
              ),
            )}
          </div>
        )}
        {/* Le liseré du cadre, PAR-DESSUS l'image et les voiles. */}
        <div className="pointer-events-none absolute inset-0" style={{ borderRadius: radius, boxShadow: "var(--hero-frame-ring)" }} />
      </div>
    </div>
  );
});
