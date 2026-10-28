/**
 * Octave mobile — au-dessus des résultats, l'ambiance que la recherche NOMME
 * (`moodsNamedBy`, la règle du bureau : « chill », « musique pour dormir »),
 * en cartes ; sinon rien. Comparée localement, sans requête.
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMusicMoods } from "@tentacle-tv/api-client";
import { moodsNamedBy } from "@tentacle-tv/shared/octave";
import { MoodCard } from "../home/MoodCard";
import { useOctavePagesProvider } from "../env/pagesEnv";
import { Shelf } from "../ui/Shelf";
import { usePageMetrics } from "../ui/pageStyle";

export const MoodResults = memo(function MoodResults({ query }: { query: string }) {
  const { t, i18n } = useTranslation("music");
  const { moods } = useMusicMoods(useOctavePagesProvider(), i18n.language);
  const named = useMemo(() => moodsNamedBy(query, moods), [query, moods]);
  const { card } = usePageMetrics();
  return <Shelf title={t("moods.resultKicker")} items={named} keyOf={(m) => m.id} render={(mood, w) => <MoodCard mood={mood} width={w} />} width={Math.round(card * 1.2)} />;
});
