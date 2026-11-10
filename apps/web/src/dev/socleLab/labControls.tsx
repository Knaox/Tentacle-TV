/**
 * Labo du socle — les CONTRÔLES : choix segmentés, interrupteur, curseur, case, champ, onglets.
 * Ce sont les vrais composants de l'application, pas des maquettes.
 */

import { useState } from "react";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { RowsIcon } from "@phosphor-icons/react/dist/csr/Rows";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/csr/SquaresFour";

import { SegmentedControl } from "../../components/library/SegmentedControl";
import { SegmentedChoice } from "../../components/settings/SegmentedChoice";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { Tabs } from "../../components/ui/Tabs";
import { rangeFill } from "../../lib/rangeFill";
import { LabPanel, LabRow, LabSection, Specimen } from "./labKit";

type Status = "all" | "unwatched" | "watched";
type View = "grid" | "list";
type Delay = "0.5" | "0.8" | "1.2" | "2";
type Tab = "films" | "series" | "music";

const STATUS = [
  { value: "all", label: "Tout" },
  { value: "unwatched", label: "Non vus", count: 128 },
  { value: "watched", label: "Vus", count: 64 },
] as const;

const VIEWS = [
  { value: "grid", label: "Grille", icon: <SquaresFourIcon size={16} /> },
  { value: "list", label: "Liste", icon: <RowsIcon size={16} /> },
] as const;

const DELAYS = [
  { value: "0.5", label: "0,5 s" },
  { value: "0.8", label: "0,8 s" },
  { value: "1.2", label: "1,2 s" },
  { value: "2", label: "2 s" },
] as const;

const TABS = [
  { id: "films", label: "Films", count: 412 },
  { id: "series", label: "Séries", count: 87 },
  { id: "music", label: "Musique" },
] as const;

/** Une case à cocher du socle : la boîte `.ui-check`, l'état sur le bouton. */
function CheckRow({ label, initial = false }: { label: string; initial?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => setChecked((v) => !v)} className="flex items-center gap-3 rounded-field px-2 py-1.5 text-sm text-content-primary">
      <span className="ui-check"><CheckIcon size={14} weight="bold" /></span>
      {label}
    </button>
  );
}

export function LabControls() {
  const [status, setStatus] = useState<Status>("unwatched");
  const [view, setView] = useState<View>("grid");
  const [delay, setDelay] = useState<Delay>("0.8");
  const [tab, setTab] = useState<Tab>("films");
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [volume, setVolume] = useState(62);

  return (
    <LabSection title="Contrôles" note="L'option retenue d'un choix segmenté est une pastille neutre ; l'interrupteur allumé prend la teinte franche ; le curseur, qui mesure, porte le dégradé du logo.">
      <LabPanel>
        <LabRow>
          <Specimen name="SegmentedControl (bibliothèque)">
            <SegmentedControl options={STATUS} value={status} onChange={setStatus} label="État de visionnage" markerId="lab-status" />
          </Specimen>
          <Specimen name="SegmentedControl · icônes">
            <SegmentedControl options={VIEWS} value={view} onChange={setView} label="Vue" markerId="lab-view" />
          </Specimen>
          <Specimen name="SegmentedChoice (réglages · .ctl-segment)">
            <SegmentedChoice label="Délai des aperçus" value={delay} options={DELAYS} onChange={setDelay} />
          </Specimen>
        </LabRow>
        <LabRow>
          <Specimen name="Tabs">
            <Tabs idPrefix="lab-tabs" label="Bibliothèques" items={TABS} active={tab} onChange={setTab} />
          </Specimen>
        </LabRow>
        <LabRow>
          <Specimen name="ToggleSwitch · allumé"><ToggleSwitch checked={on} onChange={setOn} label="Lecture automatique" /></Specimen>
          <Specimen name="ToggleSwitch · éteint"><ToggleSwitch checked={off} onChange={setOff} label="Son au démarrage" /></Specimen>
          <Specimen name="ToggleSwitch · inactif"><ToggleSwitch checked={false} onChange={() => undefined} label="Indisponible" disabled /></Specimen>
          <Specimen name={`.ctl-range · ${volume} %`} className="w-56">
            <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" className="ctl-range" style={rangeFill(volume, 0, 100)} />
          </Specimen>
        </LabRow>
        <LabRow>
          <Specimen name=".ui-check · role=checkbox">
            <div className="flex flex-col">
              <CheckRow label="Toute la série" initial />
              <CheckRow label="Les épisodes non vus seulement" />
            </div>
          </Specimen>
          <Specimen name=".field" className="w-64">
            <input className="field" placeholder="Nom du profil" aria-label="Nom du profil" />
          </Specimen>
          <Specimen name=".field · aria-invalid" className="w-64">
            <input className="field" defaultValue="Zoé " aria-invalid="true" aria-label="Nom refusé" />
          </Specimen>
          <Specimen name=".field .field-pill (recherche)" className="w-64">
            <label className="relative block w-full">
              <MagnifyingGlassIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-tertiary" />
              <input className="field field-pill pl-10" placeholder="Rechercher" aria-label="Rechercher" />
            </label>
          </Specimen>
        </LabRow>
      </LabPanel>
    </LabSection>
  );
}
