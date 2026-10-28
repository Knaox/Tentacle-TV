/**
 * Octave mobile — la rangée « Ambiances » de l'accueil : les cartes dans l'ordre
 * de l'extension (`useMusicMoods`, le crochet du bureau). Sans extension qui les
 * sert : rien, ni titre ni squelette ; l'attente garde la place de la rangée.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useMusicMoods } from "@tentacle-tv/api-client";
import { useOctavePagesProvider } from "../env/pagesEnv";
import { Shelf, ShelfSkeleton } from "../ui/Shelf";
import { usePageMetrics } from "../ui/pageStyle";
import { MoodCard } from "./MoodCard";

export const MoodsShelf = memo(function MoodsShelf() {
  const { t, i18n } = useTranslation("music");
  const { moods, pending } = useMusicMoods(useOctavePagesProvider(), i18n.language);
  const { card, isTablet } = usePageMetrics();
  if (pending) return <ShelfSkeleton />;
  // Une carte d'ambiance est plus large qu'une pochette (4:3) : on la lit d'un coup d'œil.
  const width = Math.round(card * (isTablet ? 1.25 : 1.2));
  return <Shelf title={t("moods.shelf")} items={moods} keyOf={(m) => m.id} render={(mood, w) => <MoodCard mood={mood} width={w} />} width={width} />;
});
