import { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAutoUpdate } from "../hooks/useAutoUpdate";
import type { WhatsNewSelection } from "../whatsNew/selectFeatures";
import { useWhatsNewGate } from "../whatsNew/useWhatsNewGate";
import { useWhatsNewDevHook, whatsNewGateForced } from "../whatsNew/whatsNewDev";
import { WhatsNewScreen } from "../whatsNew/WhatsNewScreen";
import { UpdateModal } from "./UpdateModal";

interface StartupOverlaysProps {
  authed: boolean;
  disclaimerAccepted: boolean;
}

/**
 * Les recouvrements de démarrage, un seul à la fois : l'écran de nouveautés
 * d'abord, la pop-up de mise à jour attend sa fermeture (`available` est un
 * état du hook, il persiste). Et l'inverse : une mise à jour en cours de
 * téléchargement ou d'installation n'est pas recouverte par des nouveautés.
 * Jamais sur /watch, jamais avant la session ni le disclaimer.
 */
export function StartupOverlays({ authed, disclaimerAccepted }: StartupOverlaysProps) {
  const update = useAutoUpdate();
  const { pathname } = useLocation();
  const desktopLike = useMemo(whatsNewGateForced, []);
  const updateAtRest = update.phase === "idle" || update.phase === "available";
  const gate = useWhatsNewGate({
    enabled: authed && disclaimerAccepted && !pathname.startsWith("/watch") && updateAtRest,
    desktopLike,
  });

  // Sélection forcée par le crochet de développement : même écran, fermeture
  // sans écriture du drapeau.
  const [forced, setForced] = useState<WhatsNewSelection | null>(null);
  useWhatsNewDevHook(setForced);
  const clearForced = useCallback(() => setForced(null), []);

  const open = forced !== null || gate.open;
  return (
    <>
      <WhatsNewScreen open={open} selection={forced ?? gate.selection} onClose={forced ? clearForced : gate.close} />
      <UpdateModal update={update} suspended={open} />
    </>
  );
}
