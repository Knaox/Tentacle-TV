/**
 * Labo du socle — les BOUTONS, les icônes, les puces et les jauges.
 */

import { useState } from "react";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/csr/DotsThree";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { HeartIcon } from "@phosphor-icons/react/dist/csr/Heart";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import type { Icon } from "@phosphor-icons/react";

import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "../../components/icons/transport";
import { LabPanel, LabRow, LabSection, Specimen } from "./labKit";

const SIZES = [
  ["btn-sm", "32"],
  ["", "40"],
  ["btn-lg", "52"],
] as const;

/** Un bouton d'icône à bascule : au trait éteint, plein et à la teinte franche allumé. */
function ToggleIcon({ icon: Glyph, label, initial = false }: { icon: Icon; label: string; initial?: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <button type="button" className="icon-btn" aria-label={label} aria-pressed={on} onClick={() => setOn((v) => !v)}>
      <Glyph size={20} weight={on ? "fill" : "regular"} />
    </button>
  );
}

export function LabButtons() {
  return (
    <>
      <LabSection title="Boutons" note="Tous en pilule. Trois tailles, la pression à 97 % en 120 ms dès l'appui ; le survol (160 ms) ne vaut qu'à la souris.">
        <LabPanel>
          <LabRow>
            {SIZES.map(([size, px]) => (
              <Specimen key={px} name={`.btn .btn-play ${size} · ${px}`}>
                <button type="button" className={`btn btn-play ${size}`}>
                  <PlayIcon size={px === "52" ? 20 : 16} /> Lecture
                </button>
              </Specimen>
            ))}
          </LabRow>
          <LabRow>
            <Specimen name=".btn-solid"><button type="button" className="btn btn-solid">Enregistrer</button></Specimen>
            <Specimen name=".btn-soft"><button type="button" className="btn btn-soft"><PlusIcon size={16} /> Ma liste</button></Specimen>
            <Specimen name=".btn-accent"><button type="button" className="btn btn-accent">Affiner</button></Specimen>
            <Specimen name=".btn-ghost"><button type="button" className="btn btn-ghost">Annuler</button></Specimen>
            <Specimen name=".btn-danger"><button type="button" className="btn btn-danger"><TrashIcon size={16} /> Supprimer</button></Specimen>
            <Specimen name=":disabled"><button type="button" className="btn btn-solid" disabled>Indisponible</button></Specimen>
          </LabRow>
          <div className="flex flex-wrap items-end gap-6 rounded-tile p-5 [--text-quaternary:var(--on-media-secondary)]" style={{ background: "linear-gradient(120deg, #5b4033, #31536b)" }}>
            <Specimen name=".btn-on-media (sur une image)">
              <button type="button" className="btn btn-on-media"><InfoIcon size={16} /> Plus d'infos</button>
            </Specimen>
            <Specimen name=".chip-on-media"><span className="chip chip-on-media">4K · VOSTFR</span></Specimen>
          </div>
        </LabPanel>
      </LabSection>

      <LabSection title="Icônes" note="Phosphor, importée une à une. Au trait au repos, pleine quand c'est actif (cliquer pour basculer) ; le transport du lecteur est toujours plein.">
        <LabPanel>
          <LabRow>
            <Specimen name=".icon-btn · aria-pressed">
              <div className="flex gap-1">
                <ToggleIcon icon={HeartIcon} label="Favori" initial />
                <ToggleIcon icon={BookmarkSimpleIcon} label="Ma liste" />
                <ToggleIcon icon={CheckCircleIcon} label="Vu" />
                <ToggleIcon icon={DownloadSimpleIcon} label="Garder hors ligne" />
              </div>
            </Specimen>
            <Specimen name=".icon-btn .btn-soft · sm, 40, lg">
              <div className="flex items-center gap-2">
                <button type="button" className="icon-btn btn-soft btn-sm" aria-label="Plus"><DotsThreeIcon size={18} weight="bold" /></button>
                <button type="button" className="icon-btn btn-soft" aria-label="Plus"><DotsThreeIcon size={20} weight="bold" /></button>
                <button type="button" className="icon-btn btn-soft btn-lg" aria-label="Plus"><DotsThreeIcon size={24} weight="bold" /></button>
              </div>
            </Specimen>
            <Specimen name="components/icons/transport (toujours plein)">
              <div className="flex items-center gap-1 text-content-primary">
                <button type="button" className="icon-btn" aria-label="Précédent"><SkipBackIcon size={20} /></button>
                <button type="button" className="icon-btn btn-solid btn-lg" aria-label="Pause"><PauseIcon size={24} /></button>
                <button type="button" className="icon-btn" aria-label="Suivant"><SkipForwardIcon size={20} /></button>
              </div>
            </Specimen>
          </LabRow>
        </LabPanel>
      </LabSection>

      <LabSection title="Puces et jauges" note="Une puce informe (24 px, rayon de 6). Ce qui se mesure porte le dégradé du logo, sur une piste neutre.">
        <LabPanel>
          <LabRow>
            <Specimen name=".chip"><span className="chip">1080p</span></Specimen>
            <Specimen name=".chip-accent"><span className="chip chip-accent">Nouveau</span></Specimen>
            <Specimen name=".chip-success"><span className="chip chip-success">Sur cet appareil</span></Specimen>
            <Specimen name=".chip-warning"><span className="chip chip-warning">En attente</span></Specimen>
            <Specimen name=".chip-danger"><span className="chip chip-danger">Échec</span></Specimen>
            <Specimen name=".ui-kbd"><span className="ui-kbd">Échap</span></Specimen>
          </LabRow>
          <LabRow>
            <Specimen name=".gauge · scaleX(0.42)" className="w-64">
              <div className="gauge w-full"><i style={{ transform: "scaleX(0.42)" }} /></div>
            </Specimen>
            <Specimen name=".gauge · scaleX(0.86)" className="w-64">
              <div className="gauge w-full"><i style={{ transform: "scaleX(0.86)" }} /></div>
            </Specimen>
            <Specimen name=".skeleton-shimmer (teinte calme, immobile)">
              <div className="skeleton-shimmer h-10 w-48 rounded-card" />
            </Specimen>
          </LabRow>
        </LabPanel>
      </LabSection>
    </>
  );
}
