/**
 * Le cadre des feuilles du hors ligne (« télécharger », « supprimer »).
 *
 * La feuille du socle (`Modal`, docs/REFONTE-UI.md § 4) dans TOUS les modes : opaque, en
 * portail, focus piégé, Échap et clic sur le voile ; 320 ms à l'entrée sur la courbe de tiroir,
 * 200 à la sortie (`useSheetExit` : la feuille se referme avant d'être démontée). En verre
 * natif (macOS 26), la même `Modal` pose sa plaque `surface`.
 *
 * PORTAIL, toujours : ouverte depuis une capsule de verre, dont le `backdrop-filter` (comme un
 * `transform`) borne les `position: fixed`, la feuille tenait dans 240 × 54 px (garde :
 * `components/ui/glass/modalPortal.test.ts`). Le voile d'attente ci-dessous aussi.
 */

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../components/ui/Modal";
import { Spinner } from "../components/ui/Spinner";

interface Props {
  label: string;
  /** L'ouverture de `useSheetExit` : `false` joue la sortie. */
  open: boolean;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
  /** `md` : la feuille de téléchargement (520 px) ; `sm` : une confirmation (420 px). */
  width: "md" | "sm";
  children: ReactNode;
}

const WIDTH = { md: 520, sm: 420 } as const;

const sheetFocusTarget = (): HTMLElement | null => document.querySelector<HTMLElement>("[data-sheet-focus]:not([disabled])");

export function OfflineSheetFrame({ label, open, onClose, role = "dialog", width, children }: Props) {
  return (
    // Le premier focus va à l'action que la feuille désigne (`data-sheet-focus`), pas à la croix.
    <Modal open={open} onClose={onClose} maxWidth={WIDTH[width]} label={label} role={role} initialFocus={sheetFocusTarget}>
      {children}
    </Modal>
  );
}

/**
 * Le voile d'attente : la feuille n'a pas encore ce qu'il lui faut (les épisodes d'une série,
 * la fiche complète d'un titre). Un voile et un anneau, en portail comme la feuille qui suit.
 */
export function SheetResolvingVeil({ label }: { label: string }) {
  return createPortal(
    <div className="ui-scrim fixed inset-0 z-[100] flex items-center justify-center" aria-busy="true">
      <Spinner tone="white" label={label} />
    </div>,
    document.body,
  );
}
