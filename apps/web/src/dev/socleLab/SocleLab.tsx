/**
 * LABO DU SOCLE — `/dev/socle`, paquets de développement seulement (Vite en dev,
 * `build:web:debug` du bureau) ; absent des paquets livrés et du client LG.
 *
 * Tous les contrôles communs de la refonte de nov. 2026 (docs/REFONTE-UI.md), en sombre et en
 * clair : on y juge un jeton ou un contrôle AVANT de le propager dans un écran. La page se rend
 * sans serveur — le banc `apps/web/bench/socle/` la capture au Chrome sans tête.
 *
 * `?vue=jetons|boutons|controles|calques` n'en montre qu'une partie (une capture par vue).
 */

import { useThemeMode } from "../../theme/useThemeMode";
import { LabButtons } from "./labButtons";
import { LabControls } from "./labControls";
import { LabOverlays } from "./labOverlays";
import { LabTokens } from "./labTokens";

const VIEWS = ["jetons", "boutons", "controles", "calques"] as const;
type LabView = (typeof VIEWS)[number];

const initialView = (): LabView | null => {
  const asked = new URLSearchParams(window.location.search).get("vue");
  return (VIEWS as readonly string[]).includes(asked ?? "") ? (asked as LabView) : null;
};

export function SocleLab() {
  const { scheme, setMode } = useThemeMode();
  const only = initialView();
  const shows = (view: LabView): boolean => only === null || only === view;

  return (
    <div className="min-h-screen bg-surface-0 text-content-primary">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-14 px-6 py-10 md:px-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="ui-eyebrow">Labo · refonte de nov. 2026</span>
            <h1 className="text-display-3 text-content-primary">Le socle</h1>
            <p className="max-w-[65ch] text-sm text-content-tertiary">
              Jetons, typographie, icônes, contrôles et mouvement communs à tous les écrans. Mode d'emploi : docs/REFONTE-UI.md.
            </p>
          </div>
          <div className="ctl-segmented inline-flex gap-0.5" role="radiogroup" aria-label="Thème">
            {(["dark", "light"] as const).map((mode) => (
              <button key={mode} type="button" role="radio" aria-checked={scheme === mode} className="ctl-segment" onClick={() => setMode(mode)}>
                {mode === "dark" ? "Sombre" : "Clair"}
              </button>
            ))}
          </div>
        </header>
        {shows("jetons") ? <LabTokens /> : null}
        {shows("boutons") ? <LabButtons /> : null}
        {shows("controles") ? <LabControls /> : null}
        {shows("calques") ? <LabOverlays /> : null}
      </div>
    </div>
  );
}
