/**
 * Le labo de l'accueil (`/dev/accueil`) : les VRAIS composants de l'axe — bannière, rangées,
 * cartes dans leurs trois variantes, avis, états — rendus avec la bibliothèque factice
 * (`labItems.ts`). Il vit DANS la coquille (`AppLayout`) : la barre du haut est la vraie.
 *
 * Dans l'application de développement, ce que les cartes demandent au survol (note, fiche)
 * part vers le serveur réel, qui ne connaît pas ces titres : le survol y reste partiel. Le
 * banc (`apps/web/bench/accueil`) branche un serveur factice et capture chaque vue, en sombre
 * et en clair. `?vue=banniere|rangees|cartes|avis|etats` n'en montre qu'une.
 */

import { useSearchParams } from "react-router-dom";

import { LabCards } from "./labCards";
import { LabNotices } from "./labNotices";
import { LabStates } from "./labStates";
import { LAB_ROWS, labItems } from "./labItems";
import { HeroBillboard } from "../../components/hero/HeroBillboard";
import { MediaRow } from "../../components/rows/MediaRow";

const VIEWS = ["banniere", "rangees", "cartes", "avis", "etats"] as const;
type View = (typeof VIEWS)[number];

export function AccueilLab() {
  const [params] = useSearchParams();
  const only = VIEWS.find((view) => view === params.get("vue")) ?? null;
  const shows = (view: View) => only === null || only === view;

  return (
    <div data-accueil-lab className="pb-24">
      {shows("banniere") && <HeroBillboard items={labItems(...LAB_ROWS.hero)} />}
      {shows("rangees") && (
        <>
          <MediaRow title="Reprendre" variant="episode" items={labItems(...LAB_ROWS.resume)} href="/dev/accueil" />
          <MediaRow title="Derniers ajouts" items={labItems(...LAB_ROWS.latestMovies)} href="/dev/accueil" />
          <MediaRow title="Grands classiques" items={labItems(...LAB_ROWS.classics)} />
        </>
      )}
      {shows("cartes") && <LabCards />}
      {shows("avis") && <LabNotices />}
      {shows("etats") && <LabStates />}
    </div>
  );
}
