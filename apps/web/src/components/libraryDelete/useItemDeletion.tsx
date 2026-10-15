import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  useDeletableEntries, useLibraryDeletionRights, type DeletableEntry, type DeletionRunSummary,
} from "@tentacle-tv/api-client";
import { deletionAllowedSomewhere } from "@tentacle-tv/shared";
import { DeleteTitlesDialog } from "./DeleteTitlesDialog";
import { DELETABLE_TYPES } from "./useDeletionSelection";
import { useToast } from "../../contexts/ToastContext";

interface Target {
  id: string | undefined;
  type: string | undefined;
  /** Le nom à montrer (« Saison 2 » plutôt que celui de Jellyfin), sinon celui de Jellyfin. */
  name?: string;
}

export interface ItemDeletion {
  /** Jellyfin laisse CE compte supprimer CE titre — sinon rien ne doit paraître. */
  allowed: boolean;
  open: () => void;
  /** La confirmation, à monter quelque part dans l'arbre. */
  dialog: ReactNode;
}

/**
 * Supprimer UN titre (fiche, saison) : rien tant que le serveur ne déclare pas
 * `library.delete`, que la politique du compte ne permet de supprimer nulle part,
 * ou que Jellyfin ne dit pas `CanDelete` pour CE titre. Le relevé du titre ne
 * part que si le compte peut supprimer quelque part.
 *
 * Réussie, la suppression referme la confirmation et le dit d'un toast : la fiche
 * d'un titre qui n'existe plus ne reste pas affichée sous un bilan (`onRemoved`
 * ramène en arrière). Un refus ou un échec garde le bilan, qui les nomme.
 */
export function useItemDeletion(target: Target, onRemoved?: (summary: DeletionRunSummary) => void): ItemDeletion {
  const { data: rights } = useLibraryDeletionRights();
  const wanted = deletionAllowedSomewhere(rights) && !!target.id && DELETABLE_TYPES.has(target.type ?? "");
  const ids = useMemo(() => (wanted && target.id ? [target.id] : []), [wanted, target.id]);
  const { data } = useDeletableEntries(ids, wanted);
  const found = target.id ? data?.entries.get(target.id) : undefined;
  const entry = useMemo<DeletableEntry | undefined>(
    () => (found && found.canDelete ? { ...found, name: target.name ?? found.name } : undefined),
    [found, target.name],
  );

  const { t } = useTranslation("libraryDelete");
  const { show } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [removed, setRemoved] = useState<DeletionRunSummary | null>(null);
  const entries = useMemo(() => (entry ? [entry] : []), [entry]);
  // Le nom, gardé : le titre parti, son relevé ne le rend plus.
  const nameRef = useRef("");
  if (entry) nameRef.current = entry.name;

  const open = useCallback(() => {
    setRemoved(null);
    setConfirming(true);
  }, []);
  const onFinished = useCallback((summary: DeletionRunSummary) => {
    if (summary.removed.length === 0) return;
    if (summary.forbidden.length + summary.failed.length + summary.skipped.length > 0) {
      setRemoved(summary);
      return;
    }
    setConfirming(false);
    show("success", t("deletedOne", { name: nameRef.current }));
    onRemoved?.(summary);
  }, [show, t, onRemoved]);
  const close = useCallback(() => {
    setConfirming(false);
    if (removed) onRemoved?.(removed);
  }, [removed, onRemoved]);

  const dialog = entry || confirming ? (
    <DeleteTitlesDialog open={confirming} entries={entries} onClose={close} onFinished={onFinished} />
  ) : null;

  return { allowed: entry !== undefined, open, dialog };
}
