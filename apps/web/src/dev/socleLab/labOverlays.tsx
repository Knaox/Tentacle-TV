/**
 * Labo du socle — ce qui FLOTTE (menu, feuille, avis, infobulle) et ce qui se regarde (carte,
 * image). Les peaux sont montrées posées ; les boutons ouvrent les vrais composants, avec leur
 * mouvement.
 */

import { useState } from "react";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/csr/DotsThree";
import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";

import { CardFrame } from "../../components/cards/CardFrame";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Dropdown } from "../../components/ui/Dropdown";
import { FadeImage } from "../../components/ui/FadeImage";
import { Modal } from "../../components/ui/Modal";
import { ModalHeader } from "../../components/ui/ModalHeader";
import { LabPanel, LabRow, LabSection, Specimen } from "./labKit";

/** Les entrées d'un menu du socle. */
function MenuItems() {
  return (
    <>
      <div className="ui-menu-label">Trier par</div>
      <button type="button" role="menuitemradio" aria-checked="true" className="ui-menu-item">
        <CheckIcon size={16} weight="bold" className="text-accent" /> Date d'ajout
      </button>
      <button type="button" role="menuitemradio" aria-checked="false" className="ui-menu-item"><span className="w-4" /> Titre</button>
      <div className="ui-menu-separator" />
      <button type="button" role="menuitem" className="ui-menu-item"><EyeIcon size={16} /> Marquer comme vu</button>
      <button type="button" role="menuitem" className="ui-menu-item"><ShareNetworkIcon size={16} /> Partager</button>
      <button type="button" role="menuitem" className="ui-menu-item ui-menu-item-danger"><TrashIcon size={16} /> Supprimer</button>
    </>
  );
}

/** Une affiche de démonstration : un aplat en SVG, servi par une adresse de données. */
const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6e5c49"/><stop offset="1" stop-color="#31536b"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/><circle cx="140" cy="90" r="46" fill="#e8c9a0" opacity=".55"/></svg>',
)}`;

function HoverCard() {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="w-32" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <CardFrame hovered={hovered} aspect="aspect-[2/3]">
        <FadeImage src={POSTER} alt="" color="#5b4033" className="h-full w-full" loading="eager" />
      </CardFrame>
    </div>
  );
}

export function LabOverlays() {
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <LabSection title="Menu, feuille, avis" note="Le menu sort de son bouton (180 ms, 120 à la sortie). La feuille entre en 320 ms sur la courbe de tiroir, sort en 200. Toujours dans un portail.">
        <LabRow>
          <Specimen name=".ui-menu · .ui-menu-item">
            <div className="ui-menu w-60"><MenuItems /></div>
          </Specimen>
          <Specimen name=".ui-sheet">
            <div className="ui-sheet flex w-80 flex-col gap-4 p-6">
              <h3 className="font-display text-heading-3">Garder hors ligne</h3>
              <p className="text-sm text-content-secondary">La saison 1, 8 épisodes — 6,4 Go sur cet appareil.</p>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-ghost">Annuler</button>
                <button type="button" className="btn btn-solid">Garder</button>
              </div>
            </div>
          </Specimen>
          <div className="flex flex-col gap-5">
            <Specimen name=".ui-toast"><div className="ui-toast"><InfoIcon size={18} className="text-accent" /> Ajouté à Ma liste</div></Specimen>
            <Specimen name=".ui-tip"><span className="ui-tip">Plein écran (F)</span></Specimen>
          </div>
        </LabRow>
        <LabPanel>
          <LabRow>
            <Specimen name="Dropdown (FloatingLayer)">
              <div className="relative">
                <button type="button" className="icon-btn btn-soft" aria-label="Plus d'actions" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                  <DotsThreeIcon size={20} weight="bold" />
                </button>
                <Dropdown open={menu} onClose={() => setMenu(false)} placement="bottom-start" className="ui-menu">
                  <MenuItems />
                </Dropdown>
              </div>
            </Specimen>
            <Specimen name="Modal + ModalHeader"><button type="button" className="btn btn-soft" onClick={() => setSheet(true)}>Ouvrir une feuille</button></Specimen>
            <Specimen name="ConfirmDialog · danger"><button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}>Supprimer…</button></Specimen>
          </LabRow>
        </LabPanel>
      </LabSection>

      <LabSection title="Carte et image" note="La carte grandit de 3 % sur place en 220 ms (survoler). L'image paraît sur sa couleur, d'un seul fondu ; déjà vue, elle est là d'emblée.">
        <LabRow>
          <Specimen name="CardFrame · FadeImage"><HoverCard /></Specimen>
          <Specimen name="FadeImage · couleur d'attente (image absente)">
            <FadeImage src="" alt="" color="#31536b" className="h-48 w-32 rounded-card" />
          </Specimen>
          <Specimen name=".ui-tile · aria-pressed">
            <div className="flex gap-3">
              <button type="button" className="ui-tile flex w-40 flex-col gap-1 p-3.5 text-left" aria-pressed="true">
                <span className="text-sm font-semibold text-content-primary">Originale</span>
                <span className="text-xs text-content-tertiary">La source, telle quelle</span>
              </button>
              <button type="button" className="ui-tile flex w-40 flex-col gap-1 p-3.5 text-left" aria-pressed="false">
                <span className="text-sm font-semibold text-content-primary">Allégée</span>
                <span className="text-xs text-content-tertiary">Moins de place</span>
              </button>
            </div>
          </Specimen>
        </LabRow>
      </LabSection>

      <Modal open={sheet} onClose={() => setSheet(false)} labelledBy="lab-sheet-title" maxWidth={520}>
        <ModalHeader title="Garder hors ligne" subtitle="Caminandes — saison 1" onClose={() => setSheet(false)} titleId="lab-sheet-title" />
        <div className="flex flex-col gap-5 px-6 pb-6">
          <p className="text-sm text-content-secondary">Trois épisodes, 412 Mo sur cet appareil. Le transfert continue fenêtre fermée.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setSheet(false)}>Annuler</button>
            <button type="button" className="btn btn-solid" onClick={() => setSheet(false)}>Garder</button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirm} title="Supprimer ce titre ?" message="Il sera retiré de la bibliothèque et du disque. Ce geste ne s'annule pas." confirmLabel="Supprimer" cancelLabel="Annuler" danger onConfirm={() => setConfirm(false)} onCancel={() => setConfirm(false)} />
    </>
  );
}
