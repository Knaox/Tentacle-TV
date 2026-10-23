/**
 * Labo du verre — `?vue=feuilles` : les VRAIES feuilles et barres flottantes
 * (lot lg7, axe Surfaces), ouvertes sur les dessous du labo. `?feuille=` en
 * choisit une au chargement (bancs reproductibles) :
 *  - `telecharger` : « garder hors ligne » (`DownloadDialog`, un épisode) ;
 *  - `supprimer`   : `DeleteDownloadModal` ;
 *  - `confirmer`, `danger` : `ConfirmDialog`, action principale puis destructive.
 */

import { useState } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DeleteDownloadModal } from "../../downloads/DeleteDownloadModal";
import { DownloadDialog } from "../../downloads/DownloadDialog";

const SHEETS = ["telecharger", "supprimer", "confirmer", "danger"] as const;
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
