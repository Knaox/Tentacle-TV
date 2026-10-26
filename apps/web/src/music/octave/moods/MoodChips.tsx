/**
 * Octave — les puces d'ambiance de la recherche VIDE (emplacement `SearchHomeMoodsSlot` de M5) : une puce par
 * ambiance, sa couleur en pastille, qui ouvre sa playlist. Elles passent à la ligne (jamais une rangée coupée).
 * Sans extension qui les sert : rien.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { octavePaths } from "../octavePaths";
import { useMoods } from "./useMoods";

export function MoodChips() {
  const { t } = useTranslation("music");
  const { moods } = useMoods();
  if (moods.length === 0) return null;
  return (
    <section aria-labelledby="octave-search-moods" className="flex flex-col gap-3">
      <h2 id="octave-search-moods" className="oc-heading px-2 text-xl text-content-primary">
        {t("moods.searchTitle")}
      </h2>
      <ul className="flex flex-wrap gap-2 px-2">
        {moods.map((mood) => (
          <li key={mood.id}>
            <Link to={octavePaths.mood(mood.id)} className="octave-chip inline-flex items-center gap-2 text-content-primary">
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-full ring-1 ring-white/40" style={{ backgroundColor: mood.color }} />
              {mood.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
