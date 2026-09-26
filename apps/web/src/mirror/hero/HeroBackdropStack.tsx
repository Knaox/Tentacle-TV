import { memo, useState } from "react";
import { HERO_FADE_MS, HERO_ZOOM_TARGET, slideVisual, type HeroSlide } from "./heroSlides";

/**
 * `HeroBackdropStack` de l'app : un calque par diapositive, en fondu croisé de
 * 1,2 s ; la diapositive active zoome de 1 à 1,06 en huit secondes (la durée
 * d'une rotation). Un calque qui s'éteint garde son zoom final le temps du
 * fondu : l'échelle ne revient à 1 qu'une fois invisible. `playing` à faux
 * (hors écran, onglet caché) suspend le zoom là où il en est.
 */
export const HeroBackdropStack = memo(function HeroBackdropStack({
  slides,
  activeIndex,
  portrait,
  playing,
}: {
  slides: HeroSlide[];
  activeIndex: number;
  portrait: boolean;
  playing: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {slides.map((slide, i) => {
        const url = slideVisual(slide, portrait);
        if (!url) return null;
        const fallbackUrl = url === slide.backdropUri ? null : slide.backdropUri;
        return (
          <CrossfadeImage key={slide.id} url={url} fallbackUrl={fallbackUrl} active={i === activeIndex} playing={playing} />
        );
      })}
    </div>
  );
});

function CrossfadeImage({ url, fallbackUrl, active, playing }: {
  url: string;
  fallbackUrl: string | null;
  active: boolean;
  playing: boolean;
}) {
  // Image introuvable : le visuel large, puis l'aplat et les voiles du cadre.
  const [failed, setFailed] = useState<readonly string[]>([]);
  const src = [url, fallbackUrl].find((u): u is string => !!u && !failed.includes(u)) ?? null;
  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: active ? 1 : 0,
        transition: `opacity ${HERO_FADE_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`,
      }}
    >
      {src && (
        <img
          // La classe retirée puis reposée à chaque activation : le zoom
          // repart de 1, sans remonter l'image (aucun re-décodage).
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setFailed((prev) => [...prev, src])}
          className={`absolute inset-0 h-full w-full object-cover ${active ? "mirror-hero-zoom" : ""}`}
          style={
            active
              ? { animationPlayState: playing ? "running" : "paused" }
              : { transform: `scale(${HERO_ZOOM_TARGET})` }
          }
        />
      )}
    </div>
  );
}
