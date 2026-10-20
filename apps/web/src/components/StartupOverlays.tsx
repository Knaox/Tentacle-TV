import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAutoUpdate } from "../hooks/useAutoUpdate";
import type { WhatsNewSelection } from "../whatsNew/selectFeatures";
import { useWhatsNewGate } from "../whatsNew/useWhatsNewGate";
import { useWhatsNewDevHook, whatsNewGateForced } from "../whatsNew/whatsNewDev";
import { WhatsNewScreen } from "../whatsNew/WhatsNewScreen";
import { isDesktopApp } from "../desktop/detect";
import { isWebDebugEnabled } from "../lib/webDebug";
import { useConnectivity } from "../offline/useConnectivity";
import { AvatarInvite } from "../profiles/avatarGallery/AvatarInvite";
import { FamilyPinStartup } from "../family/pinSuggest/FamilyPinStartup";
import { MirrorFirstRun } from "../mirror/screens";
import { useMirror } from "../mirror/useFormFactor";
import type { StartupWindowState } from "../startup/startupOrder";
import { describeStartup, setStartupReady, useStartupMayShow, usePublishStartupWindow } from "../startup/startupStore";
import { UpdateModal } from "./UpdateModal";

interface StartupOverlaysProps {
  authed: boolean;
}

/**
 * Les recouvrements de démarrage, UN à la fois, dans l'ordre de la règle
 * (`startup/startupOrder.ts`) : « Qui regarde ? » (porte d'`App`, rideau,
 * « Changer de profil »), le code PIN conseillé (`FamilyPinStartup`),
 * l'affiche d'une invitation de la Famille (coquille), les nouveautés, la
 * pop-up de mise à jour, l'invitation aux avatars (`AvatarInvite`). Dans le
 * miroir (web étroit), le premier lancement du mobile (`MirrorFirstRun` :
 * code PIN, accueil, photo, d'après le catalogue partagé) prend la place du
 * code PIN conseillé et de l'invitation aux avatars. Chacune
 * publie son état et attend son tour ; celle qui attend paraît après, rien ne
 * se perd. Jamais sur /watch, jamais avant la session (`ready`).
 *
 * Seule exception : une mise à jour EN COURS (téléchargement, installation)
 * reste à l'écran quoi qu'il arrive — elle ne s'interrompt pas, et ce qui
 * suivrait attend qu'elle se taise.
 */
export function StartupOverlays({ authed }: StartupOverlaysProps) {
  const update = useAutoUpdate();
  const { pathname } = useLocation();
  const desktopLike = useMemo(whatsNewGateForced, []);
  const ready = authed && !pathname.startsWith("/watch");
  // Hors ligne ÉTABLI seulement : `checking`, l'état du démarrage, n'est pas une absence.
  const connectivity = useConnectivity().state;
  const offline = connectivity === "offline-auto" || connectivity === "offline-manual";

  useLayoutEffect(() => {
    setStartupReady(ready);
  }, [ready]);
  useLayoutEffect(() => () => setStartupReady(false), []);

  // Les nouveautés : la porte ne tranche qu'à son tour (sa décision est
  // définitive), et un serveur injoignable ne retient pas la suite.
  const whatsNewTurn = useStartupMayShow("whatsNew");
  const gate = useWhatsNewGate({ enabled: ready && whatsNewTurn, desktopLike });

  // Sélection forcée par le crochet de développement : même écran, fermeture
  // sans écriture du drapeau.
  const [forced, setForced] = useState<WhatsNewSelection | null>(null);
  useWhatsNewDevHook(setForced);
  const clearForced = useCallback(() => setForced(null), []);
  const whatsNewOpen = forced !== null || gate.open;
  const whatsNewState: StartupWindowState = whatsNewOpen ? "open" : gate.decided || offline ? "done" : "undecided";
  usePublishStartupWindow("whatsNew", "whatsNew", whatsNewState);

  // La mise à jour : proposée à son tour ; en cours, toujours à l'écran.
  const updateTurn = useStartupMayShow("update");
  const updateRunning = update.phase !== "idle" && update.phase !== "available";
  const updateShown = updateRunning || (update.available && updateTurn);
  const updateState: StartupWindowState = updateShown ? "open" : update.available ? "pending" : "done";
  usePublishStartupWindow("update", "update", updateState);

  useStartupDebugHook();
  const mirror = useMirror();

  return (
    <>
      <WhatsNewScreen open={whatsNewOpen} selection={forced ?? gate.selection} onClose={forced ? clearForced : gate.close} />
      <UpdateModal update={update} suspended={!updateShown} />
      {authed && !mirror && <AvatarInvite desktop={desktopLike || isDesktopApp()} />}
      {authed && !mirror && <FamilyPinStartup />}
      {authed && mirror && (
        <Suspense fallback={null}>
          <MirrorFirstRun />
        </Suspense>
      )}
    </>
  );
}

/** `window.__tentacleStartup()` : l'état des fenêtres du démarrage, derrière la porte du débogage du web. */
function useStartupDebugHook(): void {
  useEffect(() => {
    if (!isWebDebugEnabled()) return;
    const w = window as unknown as { __tentacleStartup?: typeof describeStartup };
    w.__tentacleStartup = describeStartup;
    return () => {
      delete w.__tentacleStartup;
    };
  }, []);
}
