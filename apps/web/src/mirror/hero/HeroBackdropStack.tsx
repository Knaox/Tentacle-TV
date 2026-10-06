import { memo, useState } from "react";
import { useHeroArtworkUrls } from "@tentacle-tv/api-client";
import { heroSlideNeedsArtwork, heroSlideSource } from "@tentacle-tv/shared";
import { HERO_FADE_MS, HERO_ZOOM_TARGET, type HeroSlide } from "./heroSlides";

/** La taille du repli Jellyfin : celle du visuel large (`heroImageUrl`). */
const ARTWORK_SIZE = { width: 1280, quality: 85 };

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
      {slides.map((slide, i) => (
        <CrossfadeImage key={slide.id} slide={slide} portrait={portrait} active={i === activeIndex} playing={playing} />
      ))}
    </div>
  );
});

function CrossfadeImage({ slide, portrait, active, playing }: {
  slide: HeroSlide;
  portrait: boolean;
  active: boolean;
  playing: boolean;
}) {
  // Image introuvable : l'autre visuel du titre, puis son REPLI côté serveur
  // (le fond TMDB, sinon toute image Jellyfin du titre et de sa série), puis
  // l'aplat et les voiles du cadre — la règle partagée `heroSlideSource`.
  const [failed, setFailed] = useState<readonly string[]>([]);
  const sources = { wide: slide.wideUri !== undefined ? slide.wideUri : slide.backdropUri, poster: slide.posterUri, portrait, failed };
  const lookUp = active && !!slide.mediaId && heroSlideNeedsArtwork(sources);
  const artwork = useHeroArtworkUrls(slide.mediaId, lookUp, ARTWORK_SIZE);
  const src = heroSlideSource({ ...sources, artwork });
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
