import { useMemo } from "react";
import { HeroBanner } from "@/components/HeroBanner";
import type { OfflineEntry } from "@/offline/engineApi";
import { offlineHeroSlides } from "./offlineHeroSlides";

interface Props {
  entries: readonly OfflineEntry[];
  onPlay: (entry: OfflineEntry) => void;
  onInfo: (entry: OfflineEntry) => void;
}

/**
 * Le bandeau de l'accueil hors ligne : la même carte cinématique que l'accueil
 * en ligne (Ken Burns, halo, cascade, points), nourrie par les titres de
 * l'appareil. Les diapositives sont mémoïsées : `HeroBanner` remet son index à
 * zéro à chaque nouveau jeu, il ne doit changer que quand la liste change.
 */
export function OfflineHomeHero({ entries, onPlay, onInfo }: Props) {
  const slides = useMemo(() => offlineHeroSlides(entries, { onPlay, onInfo }), [entries, onPlay, onInfo]);
  if (slides.length === 0) return null;
  return <HeroBanner slides={slides} />;
}
