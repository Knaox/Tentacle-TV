import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import type { NavAccessory } from "../../redesign/nav/NavRail";
import { REQUESTS_DOCK_HEIGHT, REQUESTS_DOCK_KEY, RequestsDock } from "../../redesign/requests/RequestsDock";
import { setFocusLocked } from "../focus/focusLocks";
import type { FocusStore } from "../focus/focusStore";
import { useJustArrived } from "./liveRequests";
import { requestsDockModel } from "./requestModels";
import { RequestsPanel } from "./RequestsPanel";
import { useMyRequests } from "./useMyRequests";
import { useVigieGate, type VigieGate } from "./useVigieGate";

/**
 * Les demandes en cours dans la navigation — LE point d'entrée de cette
 * fonction de Vigie dans le rail (`useRedesignScreen`, une ligne) : un
 * accessoire du bloc du profil, ou rien. Garde fermée (pas de Vigie à jour,
 * compte sans droit) : `null`, aucune requête des demandes, aucune place
 * réservée. Ouverte : l'aperçu, TOUJOURS là, même sans demande (son état
 * discret), et OK ouvre la fenêtre.
 *
 * Pendant le déplacement d'une entrée du rail, l'aperçu est verrouillé comme
 * le profil : ce n'est pas une page, rien ne s'y pose.
 *
 * En DIRECT (`useMyRequests`) : ce qui avance passe devant l'éventail, son
 * affiche se colore au fil de l'avancement ; ce qui vient d'arriver y reste
 * le temps de se montrer (`PEEK_ARRIVED_MS`).
 */

/** Un titre arrivé reste devant l'aperçu ce temps-là : sa couleur, son camembert qui s'efface. */
const PEEK_ARRIVED_MS = 1800;

export function useRequestsAccessory(focus: FocusStore, moving: boolean): NavAccessory | null {
  const gate = useVigieGate();
  const screenFocused = useIsFocused();
  const open = gate !== null;
  useEffect(() => {
    if (!open) return undefined;
    setFocusLocked(focus, REQUESTS_DOCK_KEY, moving);
    return () => setFocusLocked(focus, REQUESTS_DOCK_KEY, false);
  }, [focus, moving, open]);
  return useMemo(
    () => (gate ? { height: REQUESTS_DOCK_HEIGHT, node: <RequestsEntry gate={gate} active={screenFocused} /> } : null),
    [gate, screenFocused],
  );
}

const RequestsEntry = memo(function RequestsEntry({ gate, active }: { gate: VigieGate; active: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { titles, reading } = useMyRequests(gate, { watching: open, active });
  const arrived = useJustArrived(PEEK_ARRIVED_MS);
  const model = useMemo(() => requestsDockModel(titles, t, reading, arrived), [titles, t, reading, arrived]);
  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);
  return (
    <>
      <RequestsDock model={model} onSelect={openPanel} />
      {open ? <RequestsPanel titles={titles} reading={reading} onClose={closePanel} /> : null}
    </>
  );
});
