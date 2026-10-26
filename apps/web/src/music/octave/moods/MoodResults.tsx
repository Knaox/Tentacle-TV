/**
 * Octave — l'ambiance qu'une recherche validée NOMME (« chill », « musique pour dormir » : `moodsNamedBy`, local,
 * aucune requête), au-dessus des résultats (emplacement `SearchMoodResultsSlot` de M5) : une bande à sa couleur,
 * « Écouter » d'un geste, le clic ouvre sa playlist. Ne nomme aucune ambiance, ou pas d'extension : rien.
 */

import { memo, useMemo } from "react";
import { Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ExternalMusicMood } from "@tentacle-tv/shared/music";
import { octavePaths } from "../octavePaths";
import { moodBackground, moodsNamedBy } from "./moodModel";
import { useMoodPlayback } from "./useMoodPlayback";
import { useMoods } from "./useMoods";

const MoodResult = memo(function MoodResult({ mood }: { mood: ExternalMusicMood }) {
  const { t } = useTranslation("music");
  const { play, warm } = useMoodPlayback();
  const style = useMemo(() => ({ backgroundImage: moodBackground(mood.color) }), [mood.color]);
  return (
    <li className="relative flex min-h-20 items-center gap-4 overflow-hidden rounded-[var(--oc-radius-art)] px-5 py-3 shadow-[var(--oc-shadow-art)]" style={style}>
      <Link
        to={octavePaths.mood(mood.id)}
        aria-label={t("moods.open", { name: mood.name })}
        onPointerEnter={() => warm(mood.id, "hover")}
        className="min-w-0 flex-1 rounded-sm text-white after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-white/80">{t("moods.resultKicker")}</span>
        <span className="block truncate text-xl font-bold">{mood.name}</span>
      </Link>
      <button
        type="button"
        onPointerDown={() => warm(mood.id, "press")}
        onClick={() => void play(mood.id)}
        aria-label={t("moods.play", { name: mood.name })}
        className="octave-brand-fill relative z-10 flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full pl-4 pr-5 text-sm font-bold shadow-[var(--oc-shadow-play)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:scale-95"
      >
        <Play className="h-4 w-4" fill="currentColor" aria-hidden />
        {t("moods.listen")}
      </button>
    </li>
  );
});

export function MoodResults({ query }: { query: string }) {
  const { moods } = useMoods();
  const named = useMemo(() => moodsNamedBy(query, moods), [query, moods]);
  if (named.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-2 px-2 md:grid-cols-2">
      {named.map((mood) => (
        <MoodResult key={mood.id} mood={mood} />
      ))}
    </ul>
  );
}
