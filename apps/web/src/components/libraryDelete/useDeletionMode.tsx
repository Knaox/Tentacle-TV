import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare } from "lucide-react";
import type { DeletableEntry, DeletionRunSummary } from "@tentacle-tv/api-client";
import { chipCls } from "../library/filterChip";
import { DeleteTitlesDialog } from "./DeleteTitlesDialog";
import { DeletionSelectionBar } from "./DeletionSelectionBar";
import { useDeletionSelection, type DeletionSelection } from "./useDeletionSelection";

interface Options {
  /** Jellyfin laisse ce compte supprimer ici (droits lus par le serveur). Faux : rien ne paraît. */
  allowed: boolean;
  active: boolean;
  setActive: (active: boolean) => void;
  universe: readonly string[];
  entries: ReadonlyMap<string, DeletableEntry> | undefined;
  /** Le relevé des verdicts a échoué : la barre le dit et propose de relancer. */
  failed?: boolean;
  onRetry?: () => void;
  note?: string | null;
}

export interface DeletionMode {
  selection: DeletionSelection;
  /** « Sélectionner » — `null` quand ce compte ne peut rien supprimer ici. */
  button: ReactNode;
  /** La barre et le dialogue, montés seulement en mode sélection. */
  overlays: ReactNode;
}

/**
 * Le mode « supprimer des titres » d'une grille, prêt à poser : le bouton, la
 * barre, la confirmation. La grille fournit l'univers (ce que « tout
 * sélectionner » couvre) et les verdicts de Jellyfin ; elle lit
 * `selection.markOf(id)` pour chaque carte. Après une suppression sans échec, le
 * mode se referme avec le dialogue ; sinon il reste ouvert sur ce qui reste.
 */
export function useDeletionMode({ allowed, active, setActive, universe, entries, failed, onRetry, note }: Options): DeletionMode {
  const { t } = useTranslation("libraryDelete");
  const [confirming, setConfirming] = useState(false);
  const selection = useDeletionSelection({ active: active && allowed, setActive, universe, entries, paused: confirming });
  // Les titres confirmés, figés à l'ouverture : la sélection s'élague pendant la suppression.
  const [frozen, setFrozen] = useState<DeletableEntry[]>([]);
  const lastRun = useRef<DeletionRunSummary | null>(null);

  const openConfirm = useCallback(() => {
    lastRun.current = null;
    setFrozen(selection.selected);
    setConfirming(true);
  }, [selection.selected]);
  const onFinished = useCallback((summary: DeletionRunSummary) => { lastRun.current = summary; }, []);
  const closeConfirm = useCallback(() => {
    setConfirming(false);
    const run = lastRun.current;
    if (run && run.forbidden.length + run.failed.length + run.skipped.length === 0) selection.exit();
  }, [selection]);

  const button = allowed ? (
    <button
      type="button"
      onClick={selection.active ? selection.exit : selection.enter}
      aria-pressed={selection.active}
      title={t("selectHint")}
      className={`${chipCls(selection.active)} inline-flex cursor-pointer items-center gap-1.5`}
    >
      <CheckSquare aria-hidden className="h-3.5 w-3.5" strokeWidth={2.1} />
      {selection.active ? t("done") : t("select")}
    </button>
  ) : null;

  const overlays = selection.active ? (
    <>
      <DeletionSelectionBar selection={selection} onDelete={openConfirm} failed={failed} onRetry={onRetry} note={note} />
      <DeleteTitlesDialog open={confirming} entries={frozen} onClose={closeConfirm} onFinished={onFinished} />
    </>
  ) : null;

  return { selection, button, overlays };
}
