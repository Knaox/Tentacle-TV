/**
 * LABO DU LECTEUR — `/dev/lecteur`, paquets de développement seulement (Vite en dev,
 * `build:web:debug` du bureau) ; absent des paquets livrés et du client LG.
 *
 * Les VRAIS composants d'habillage du lecteur (refonte de nov. 2026), posés sur une image fixe à
 * la place de la vidéo, avec des données factices : on y juge une capsule, un menu, un encart
 * AVANT de le voir dans une lecture. Le banc `apps/web/bench/lecteur/` le capture au Chrome sans
 * tête, en sombre et en clair.
 *
 * `?vue=` choisit l'écran (une vue par capture) ; chaque vue lit ses états dans l'adresse.
 */

import type { ComponentType } from "react";
import { WatchTogetherContext } from "@tentacle-tv/api-client";
import { labParam } from "./labFixtures";
import { labWtContext } from "./labWatchTogether";
import { LabOverlays } from "./labOverlays";
import { LabPip } from "./labPip";
import { LabPlayerDesktop } from "./labPlayerDesktop";
import { LabScreens } from "./labScreens";
import { LabPlayerWeb } from "./labPlayerWeb";

const VIEWS: Record<string, ComponentType> = {
  web: LabPlayerWeb,
  bureau: LabPlayerDesktop,
  encarts: LabOverlays,
  ecrans: LabScreens,
  pip: LabPip,
};

const IDLE = labWtContext();

export function LecteurLab() {
  const asked = labParam("vue") ?? "web";
  const View = VIEWS[asked];
  // Hors séance par défaut ; les vues Watch Together posent la leur par-dessus.
  if (View) return <WatchTogetherContext.Provider value={IDLE}><View /></WatchTogetherContext.Provider>;
  return (
    <div className="min-h-screen bg-surface-0 p-10 text-content-primary">
      <span className="ui-eyebrow">Labo · refonte de nov. 2026</span>
      <h1 className="text-display-3">Le lecteur</h1>
      <ul className="mt-6 flex flex-col gap-2 text-sm">
        {Object.keys(VIEWS).map((view) => (
          <li key={view}><a className="text-accent underline" href={`?vue=${view}`}>?vue={view}</a></li>
        ))}
      </ul>
    </div>
  );
}
