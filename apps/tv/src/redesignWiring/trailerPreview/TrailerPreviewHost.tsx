import type { ReactNode } from "react";
import { TrailerPreviewProvider, type PreviewZoneRenderer } from "../../redesign/cards/trailerPreviewPort";
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
  return <TrailerPreviewProvider zone={NoZone} warm={warm}>{children}</TrailerPreviewProvider>;
}

/** TRANSITOIRE : la zone arrive au commit suivant. */
const NoZone: PreviewZoneRenderer = () => null;
