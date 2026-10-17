import type { ReactNode } from "react";
import { TrailerPreviewProvider } from "../../redesign/cards/trailerPreviewPort";
import { TrailerZone } from "./TrailerZone";
import { useTvPreviewWarm } from "./usePreviewWarmTv";

/**
 * La ZONE D'APERÇU des téléviseurs (Apple TV, Android TV) — le fournisseur du
 * port (`trailerPreviewPort`), UN pour l'app, monté sous le client et le cache
 * de requêtes (à côté de `QualityBadgeHost`). Chaque page pose sa zone
 * (`PreviewZoneSlot`) ; les titres autour du focus se préparent d'avance au
 * serveur (`useTvPreviewWarm`).
 */
export function TrailerPreviewHost({ children }: { children: ReactNode }) {
  const warm = useTvPreviewWarm();
  return <TrailerPreviewProvider zone={TrailerZone} warm={warm}>{children}</TrailerPreviewProvider>;
}
