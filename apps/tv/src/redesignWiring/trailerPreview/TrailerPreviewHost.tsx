import { useMemo, useState, type ReactNode } from "react";
import type { TrailerPreviewSubject } from "@tentacle-tv/shared";
import { TrailerPreviewProvider, type CardPreview } from "../../redesign/cards/trailerPreviewPort";
import { useTrailerPreviewsEnabled } from "../../lib/trailerPreviewSettings";
import { PreviewSession } from "./PreviewSession";
import { useTvPreviewWarm } from "./usePreviewWarmTv";

/**
 * L'aperçu de bande-annonce au focus des cartes de rangée (Apple TV, Android
 * TV) — le fournisseur du port (`trailerPreviewPort`), UN pour l'app, monté
 * sous le client et le cache de requêtes (à côté de `QualityBadgeHost`).
 *
 * Chaque carte de rangée appelle `useTvTrailerPreview` : quelques états, rien
 * d'autre. Seule la carte FOCALISÉE (et le temps de son repli) monte une
 * session (`PreviewSession`) — la requête, la machine, la vidéo : une rangée
 * de vingt cartes n'en paie qu'une. Réglage coupé : aucune session du tout.
 * Les titres autour du focus se préparent d'avance au serveur
 * (`useTvPreviewWarm`) : leur aperçu part sans attendre sa décision.
 */
export function TrailerPreviewHost({ children }: { children: ReactNode }) {
  const warm = useTvPreviewWarm();
  return <TrailerPreviewProvider usePreview={useTvTrailerPreview} warm={warm}>{children}</TrailerPreviewProvider>;
}

/** Le crochet du port, appelé par chaque carte de rangée à chaque rendu. */
function useTvTrailerPreview(subject: TrailerPreviewSubject | null, focused: boolean): CardPreview | null {
  const enabled = useTrailerPreviewsEnabled();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = enabled && subject !== null && (focused || busy);
  const video = useMemo(
    () => (active && subject ? <PreviewSession subject={subject} focused={focused} onExpanded={setExpanded} onBusy={setBusy} /> : null),
    [active, subject, focused],
  );
  // Le focus parti, la grande carte se replie dans le rendu MÊME du flou, sans attendre que la
  // machine le constate (deux rendus de plus : l'ancienne architecture ne regroupe pas les états
  // posés par les effets) ; la vidéo, elle, reste le temps de son fondu de sortie.
  const shown = expanded && active && focused;
  return useMemo(() => (video ? { expanded: shown, video } : null), [video, shown]);
}
