/**
 * Labo du verre — `?vue=feuilles` : les VRAIES feuilles et barres flottantes
 * (lot lg7, axe Surfaces), ouvertes sur les dessous du labo. `?feuille=` en
 * choisit une au chargement (bancs reproductibles) :
 *  - `telecharger` : « garder hors ligne » (`DownloadDialog`, un épisode) ;
 *  - `supprimer`   : `DeleteDownloadModal` ;
 *  - `confirmer`, `danger` : `ConfirmDialog`, action principale puis destructive ;
 *  - `barre-favoris`, `barre-vus`, `barre-suppression` : les barres de sélection
 *    qui flottent (`FloatingBar`), au bas des dessous du labo ;
 *  - `barre-liste`, `pastille-reco` : l'ajout d'une liste partagée, et
 *    « Nouveautés disponibles » sous la barre du haut ;
 *  - `message-admin` : un message de l'administrateur, câblé comme son hôte.
 */

import { useState } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { SelectionToolbar } from "../../components/SelectionToolbar";
import { WatchedSelectionToolbar } from "../../components/WatchedSelectionToolbar";
import { DeletionSelectionBar } from "../../components/libraryDelete/DeletionSelectionBar";
import type { DeletionSelection } from "../../components/libraryDelete/useDeletionSelection";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { RecoNewerPill } from "../../components/reco/RecoNewerPill";
import { SharedListAddBar } from "../../components/share/SharedListAddBar";
import { MessageBannerCard } from "../../components/session/SessionMessageHost";
import { useGlassControl } from "../../components/ui/glass/useGlassControl";
import { DeleteDownloadModal } from "../../downloads/DeleteDownloadModal";
import { DownloadDialog } from "../../downloads/DownloadDialog";

const SHEETS = ["telecharger", "supprimer", "confirmer", "danger", "barre-favoris", "barre-vus", "barre-suppression", "barre-liste", "pastille-reco", "message-admin"] as const;
type LabSheet = (typeof SHEETS)[number] | null;

const EPISODE = {
  Id: "lab-episode",
  Name: "Le phare",
  Type: "Episode",
  SeriesName: "Banc Nuit",
  SeriesId: "lab-series",
  SeasonId: "lab-season",
  IndexNumber: 3,
  ParentIndexNumber: 1,
} as unknown as MediaItem;

const noop = () => {};

const DELETION = {
  active: true, enter: noop, exit: noop, markOf: () => "off", toggle: noop, selectAll: noop, clear: noop,
  selected: [{}, {}, {}], selectableCount: 42, universeCount: 58, ready: true,
} as unknown as DeletionSelection;

const initialSheet = (): LabSheet => {
  const asked = new URLSearchParams(window.location.search).get("feuille");
  return SHEETS.find((s) => s === asked) ?? null;
};

export function LabSheets({ top }: { top: number }) {
  const [sheet, setSheet] = useState<LabSheet>(initialSheet);
  const close = () => setSheet(null);
  return (
    <>
      <div style={{ position: "absolute", top, left: 24, display: "flex", gap: 8 }}>
        {SHEETS.map((s) => (
          <button key={s} type="button" onClick={() => setSheet(s)} style={{ padding: "6px 10px", borderRadius: 8, background: "#7c3aed", color: "#fff" }}>
            {s}
          </button>
        ))}
      </div>
      {sheet === "telecharger" && <DownloadDialog items={[EPISODE]} onClose={close} />}
      {sheet === "supprimer" && <DeleteDownloadModal title="Banc Nuit — Le phare" busy={false} onConfirm={close} onClose={close} />}
      {sheet === "barre-favoris" && <SelectionToolbar count={3} onSelectAll={noop} onCancel={close} onDelete={noop} isDeleting={false} removal />}
      {sheet === "barre-vus" && (
        <WatchedSelectionToolbar count={4} onSelectAll={noop} onCancel={close} onMarkWatched={noop} onMarkUnwatched={noop} isBusy={false} onDownload={noop} downloadLabel="Télécharger (4)" />
      )}
      {sheet === "barre-suppression" && <DeletionSelectionBar selection={DELETION} onDelete={noop} />}
      {sheet === "barre-liste" && <SharedListAddBar kind="watchlist" count={5} isAdding={false} added={false} onAdd={noop} />}
      <RecoNewerPill visible={sheet === "pastille-reco"} onShow={close} />
      {sheet === "message-admin" && <LabAdminMessage onClose={close} />}
      <ConfirmDialog
        open={sheet === "confirmer" || sheet === "danger"}
        title={sheet === "danger" ? "Supprimer ce profil ?" : "Partager vos titres likés ?"}
        message="Une phrase d'explication sur deux lignes, pour juger la lisibilité du texte secondaire sur la plaque."
        confirmLabel={sheet === "danger" ? "Supprimer" : "Partager"}
        cancelLabel="Annuler"
        danger={sheet === "danger"}
        onConfirm={close}
        onCancel={close}
      />
    </>
  );
}

function LabAdminMessage({ onClose }: { onClose: () => void }) {
  const glass = useGlassControl<HTMLDivElement>({ scale: "surface" });
  return (
    <div className="fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
      <div className="w-[min(28rem,100%)]">
        <MessageBannerCard
          header="Maintenance ce soir"
          text={"Le serveur redémarre à 23 h pour une mise à jour.\nLa lecture reprendra d'elle-même."}
          onDismiss={onClose}
          glass={glass}
        />
      </div>
    </div>
  );
}
