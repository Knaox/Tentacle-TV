/**
 * LABO DES RÉGLAGES ET DE L'ADMINISTRATION — `/dev/reglages`, paquets de développement
 * seulement (Vite en dev, `build:web:debug` du bureau) ; absent des paquets livrés et du
 * client LG.
 *
 * Les VRAIS écrans de l'axe (réglages, administration, connexion, profils, assistant, aide) sur
 * un faux serveur : on y juge une page AVANT de la livrer, sans serveur ni Jellyfin. Le banc
 * `apps/web/bench/reglages/` les capture au Chrome sans tête, en sombre et en clair.
 *
 * `?vue=<id>` ouvre un écran (`labViews.ts`) ; sans lui, l'index.
 */

import { LabScreens } from "./LabScreens";
import { LabWorld } from "./LabWorld";
import { routesFor } from "./labFixtures";
import { LAB_VIEWS, labViewOf, type LabView } from "./labViews";

const GROUPS: readonly LabView["group"][] = ["Réglages", "Administration", "Compte et profils", "Installation et aide"];

export interface ReglagesLabProps {
  /** Le banc de capture : une adresse sans donnée factice est notée, jamais envoyée au serveur. */
  strict?: boolean;
}

export function ReglagesLab({ strict = false }: ReglagesLabProps) {
  const params = new URLSearchParams(window.location.search);
  const view = labViewOf(params.get("vue"));
  if (view) {
    // `?ancre=` vise une ligne (`#skipPassages`) ; `?q=` s'ajoute à l'adresse (`?pin=1`).
    const anchor = params.get("ancre");
    const query = params.get("q");
    const path = `${view.path}${query ? `${view.path.includes("?") ? "&" : "?"}${query}` : ""}${anchor ? `#${anchor}` : ""}`;
    return (
      <LabWorld path={path} routes={routesFor(view)} strict={strict}>
        <LabScreens />
      </LabWorld>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 text-content-primary">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10 px-6 py-10 md:px-10">
        <header className="flex flex-col gap-2">
          <span className="ui-eyebrow">Labo · refonte de nov. 2026</span>
          <h1 className="text-display-3 text-content-primary">Réglages et administration</h1>
          <p className="max-w-[65ch] text-sm text-content-tertiary">
            Les vrais écrans de l'axe, sur des données factices. Chaque lien recharge la page sur une vue.
          </p>
        </header>
        {GROUPS.map((group) => (
          <section key={group} className="flex flex-col gap-3">
            <h2 className="text-heading-2 text-content-primary">{group}</h2>
            <div className="flex flex-wrap gap-2">
              {LAB_VIEWS.filter((v) => v.group === group).map((v) => (
                <a key={v.id} href={`?vue=${v.id}`} className="btn btn-soft btn-sm">{v.label}</a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
