import { useState, useEffect, useRef, memo } from "react";
import { Image } from "react-native";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_BANNER_CARD } from "@tentacle-tv/theme";
import { HeroConfig } from "../../theme/colors";
import { TVBannerCardFrame } from "./TVBannerCardFrame";
import { TVHeroBackdrop, backdropUriOf } from "./TVHeroBackdrop";
import { TVHeroContent } from "./TVHeroContent";
import { TVHeroIndicators } from "./TVHeroIndicators";

interface TVHeroBillboardProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onDetail: (item: MediaItem) => void;
  onBannerFocus?: () => void;
  /** Called whenever the active item changes (auto-rotate or manual). */
  onItemChange?: (item: MediaItem) => void;
}

/**
 * Le billboard de l'accueil — une CARTE de 62 vh (parité webOS), plus un plein
 * cadre. Ici on ne fait que :
 *  - faire tourner l'index (rotation continue, façon Netflix) ;
 *  - synchroniser le CONTENU (logo/titre) avec l'image RÉELLEMENT affichée :
 *    `displayItem` ne change qu'au `onSettled` du backdrop → pas de désync
 *    (le titre n'apparaît pas avant que son image soit là).
 * Le halo derrière la carte suit l'image affichée, en source minuscule
 * (128 px) — même économie que `HeroAmbilight` web.
 */
export const TVHeroBillboard = memo(function TVHeroBillboard({
  items,
  onPlay,
  onDetail,
  onBannerFocus,
  onItemChange,
}: TVHeroBillboardProps) {
  const client = useJellyfinClient();
  const [index, setIndex] = useState(0);
  const [displayItem, setDisplayItem] = useState<MediaItem | undefined>(items[0]);
  const indexRef = useRef(0);
  indexRef.current = index;

  // Précharge backdrops ET logos → l'image suivante est en cache avant le fondu
  // (le fondu démarre onLoad ; en cache il est immédiat) et le logo ne reflashe pas.
  useEffect(() => {
    items.forEach((it) => {
      const id = it.Type === "Episode" && it.SeriesId ? it.SeriesId : it.Id;
      const bd = client.getImageUrl(id, "Backdrop", { width: 1920, quality: 85 });
      if (bd) Image.prefetch(bd);
      const hasLogo = it.ImageTags?.Logo != null || (it.Type === "Episode" && it.SeriesId != null);
      if (hasLogo) {
        const logo = client.getImageUrl(id, "Logo", { width: 460, quality: 90 });
        if (logo) Image.prefetch(logo);
      }
    });
  }, [items, client]);

  // Rotation automatique (continue).
  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, HeroConfig.rotateInterval);
    return () => clearInterval(timer);
  }, [items.length]);

  // Notifie le parent (ambient backdrop) sur l'item affiché.
  useEffect(() => {
    if (displayItem) onItemChange?.(displayItem);
  }, [displayItem, onItemChange]);

  if (items.length === 0) return null;

  const current = items[index];
  const content = displayItem ?? current;

  return (
    <TVBannerCardFrame
      heightVh={TV_BANNER_CARD.hauteurAccueilVh}
      ambilightUri={backdropUriOf(client, content, 128, 70)}
    >
      <TVHeroBackdrop
        current={current}
        onSettled={() => setDisplayItem(items[indexRef.current])}
      />

      <TVHeroContent
        item={content}
        onPlay={onPlay}
        onDetail={onDetail}
        onButtonFocus={onBannerFocus}
      />

      <TVHeroIndicators count={items.length} activeIndex={index} />
    </TVBannerCardFrame>
  );
});
