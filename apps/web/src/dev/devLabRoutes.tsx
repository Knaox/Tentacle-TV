/**
 * Les routes des labos de développement, pour `App.tsx` : une page par axe de la refonte, plus
 * le labo du verre. Chaque labo vaut `null` hors des paquets de développement (voir son
 * `devRoute.ts`) : dans un paquet livré et dans le client LG, ces deux fonctions ne rendent rien.
 */

import type { ReactElement } from "react";
import { Route } from "react-router-dom";
import { DevAccueilLab } from "./accueilLab/devRoute";
import { DevFichesLab } from "./fichesLab/devRoute";
import { DevGlassLab } from "./glassLab/devRoute";
import { DevHorsLigneLab } from "./horsLigneLab/devRoute";
import { DevLecteurLab } from "./lecteurLab/devRoute";
import { DevOctaveLab } from "./octaveLab/devRoute";
import { DevReglagesLab } from "./reglagesLab/devRoute";
import { DevSocleLab } from "./socleLab/devRoute";

/**
 * Les labos pleine page, hors de la coquille. Seul le labo du verre passe par la garde (il lit
 * de vraies données) ; les autres rendent de vrais écrans sur des données factices.
 */
export function devLabRoutes(guard: (el: ReactElement) => ReactElement): ReactElement {
  return (
    <>
      {DevGlassLab ? <Route path="/dev/verre" element={guard(<DevGlassLab />)} /> : null}
      {DevSocleLab ? <Route path="/dev/socle" element={<DevSocleLab />} /> : null}
      {DevFichesLab ? <Route path="/dev/fiches/*" element={<DevFichesLab />} /> : null}
      {/* Le labo du hors ligne ne monte ses écrans qu'avec le pont factice de son banc. */}
      {DevHorsLigneLab ? <Route path="/dev/hors-ligne/*" element={<DevHorsLigneLab />} /> : null}
      {DevLecteurLab ? <Route path="/dev/lecteur" element={<DevLecteurLab />} /> : null}
      {DevReglagesLab ? <Route path="/dev/reglages" element={<DevReglagesLab />} /> : null}
      {DevOctaveLab ? <Route path="/dev/octave" element={<DevOctaveLab />} /> : null}
    </>
  );
}

/** Le labo de l'accueil, DANS la coquille : sa barre du haut est la vraie. */
export function devShellLabRoutes(): ReactElement | null {
  return DevAccueilLab ? <Route path="dev/accueil" element={<DevAccueilLab />} /> : null;
}
