import type { ReactNode } from "react";
import { useRowHeadTrial } from "../../lib/rowHeadTrial";
import { RowHeadProvider } from "../../redesign/rows/rowHeadMode";

/**
 * L'essai « la carte en aperçu passe en tête » branché sur le réglage du
 * téléviseur (`lib/rowHeadTrial.ts`, Réglages › Lecture) : toutes les rangées
 * le suivent aussitôt (`rowHeadMode`).
 */
export function RowHeadTrialProvider({ children }: { children: ReactNode }) {
  return <RowHeadProvider value={useRowHeadTrial()}>{children}</RowHeadProvider>;
}
