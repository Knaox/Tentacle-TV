/**
 * Octave — la carte d'une ambiance : son image (`MoodArtwork` : sa couleur, la houle d'Octave au pied), son nom en
 * haut (la houle « en cours » et Lecture gardent le pied). Le clic ouvre sa playlist ; le bouton Lecture (survol,
 * comme toute carte) la lit d'un geste.
 */

import { memo } from "react";
import { Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ExternalMusicMood } from "@tentacle-tv/shared/music";
import { CollectionSwell } from "../motion/NowSwell";
import { octavePaths } from "../octavePaths";
import { MoodArtwork } from "./MoodArtwork";
import { moodContextId, useMoodPlayback } from "./useMoodPlayback";

export const MoodCard = memo(function MoodCard({ mood }: { mood: ExternalMusicMood }) {
  const { t } = useTranslation("music");
  const { play, warm } = useMoodPlayback();
  return (
    <Link
      to={octavePaths.mood(mood.id)}
      aria-label={t("moods.open", { name: mood.name })}
      className="octave-card group relative block min-w-0 rounded-[var(--oc-radius-art)] p-2 transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      onPointerEnter={() => warm(mood.id, "hover")}
    >
      <MoodArtwork id={mood.id} color={mood.color} artworkUrl={mood.artworkUrl} className="aspect-[4/3] w-full rounded-[var(--oc-radius-art)] shadow-[var(--oc-shadow-art)]">
        <p className="absolute left-3 right-3 top-2.5 truncate text-lg font-bold leading-6 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]" title={mood.name}>
          {mood.name}
        </p>
        <CollectionSwell contextId={moodContextId(mood.id)} />
        <button
          type="button"
          aria-label={t("moods.play", { name: mood.name })}
          onPointerDown={() => warm(mood.id, "press")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void play(mood.id);
          }}
          className="octave-card-play octave-hover-only octave-brand-fill absolute bottom-2 right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full shadow-[var(--oc-shadow-play)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:scale-95"
        >
          <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
        </button>
      </MoodArtwork>
    </Link>
  );
});
