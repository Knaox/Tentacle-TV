/**
 * État du wizard de setup — et démarrage OPTIMISTE sur desktop.
 *
 * Le boot bloquait jusqu'à 4 s sur `/api/setup/status` (spinner plein écran)
 * alors que la réponse est connue depuis le lancement précédent : sur un lien
 * lent ou coupé, on payait l'attente pour rien.
 *
 * Desktop : dès qu'une vérification a confirmé un serveur installé, on retient
 * `tentacle_setup_done` et les lancements suivants rendent l'app IMMÉDIATEMENT.
 * La vérification part quand même en tâche de fond et corrige l'état si le
 * serveur a été réinitialisé entre-temps (retour au wizard).
 *
 * Web : comportement inchangé (5 tentatives espacées puis OfflineBanner). Le
 * repli hors ligne desktop n'y existe pas — un démarrage optimiste y ferait
 * clignoter l'app avant la bannière, ce qui serait pire que le spinner.
 */

import { useCallback, useEffect, useState } from "react";
import { isDesktopApp } from "../desktop/bridge";
import { reportPossibleOutage } from "../offline/connectivityStore";

const SETUP_DONE_KEY = "tentacle_setup_done";
const DESKTOP_TIMEOUT_MS = 4000;
const RETRY_DELAY_MS = 2000;

const readSetupDone = (): boolean => {
  try {
    return localStorage.getItem(SETUP_DONE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeSetupDone = (done: boolean): void => {
  try {
    if (done) localStorage.setItem(SETUP_DONE_KEY, "1");
    else localStorage.removeItem(SETUP_DONE_KEY);
  } catch {
    /* Persistance impossible : on repartira du spinner au prochain lancement. */
  }
};

export interface SetupStatus {
  /** `null` = pas encore tranché → l'appelant affiche le spinner. */
  setupRequired: boolean | null;
  backendDown: boolean;
  /** Pose aussi le drapeau de démarrage optimiste (fin du wizard). */
  setSetupRequired: (value: boolean) => void;
}

export function useSetupStatus(needsServerUrl: boolean): SetupStatus {
  // Desktop déjà installé : on tranche AVANT le premier render — plus de spinner.
  const [setupRequired, setSetupRequired] = useState<boolean | null>(() =>
    isDesktopApp() && readSetupDone() ? false : null,
  );
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    if (needsServerUrl) {
      setSetupRequired(false);
      return;
    }
    const base = isDesktopApp() ? localStorage.getItem("tentacle_server_url") || "" : "";
    // Desktop : UNE tentative bornée à 4 s — un boot hors ligne ne doit pas
    // bloquer ~10 s sur les retries web ; le mode Hors ligne prend le relais
    // (reportPossibleOutage → sonde immédiate → pastille + session locale).
    const maxAttempts = isDesktopApp() ? 1 : 5;
    let attempts = 0;
    let cancelled = false;

    const check = () => {
      const controller = new AbortController();
      const timeoutId = isDesktopApp()
        ? setTimeout(() => controller.abort(), DESKTOP_TIMEOUT_MS)
        : null;
      fetch(`${base}/api/setup/status`, isDesktopApp() ? { signal: controller.signal } : undefined)
        .then((r) => {
          if (r.status >= 500) throw new Error(`backend ${r.status}`);
          return r.json();
        })
        .then((data) => {
          if (cancelled) return;
          // Vérité serveur : elle prime toujours sur le démarrage optimiste.
          const running = data.state === "running";
          writeSetupDone(running);
          setBackendDown(false);
          setSetupRequired(!running);
        })
        .catch(() => {
          if (cancelled) return;
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(check, RETRY_DELAY_MS);
            return;
          }
          // Backend injoignable — pas de wizard de setup.
          if (isDesktopApp()) {
            setSetupRequired(false);
            reportPossibleOutage();
          } else {
            setBackendDown(true);
            setSetupRequired(false);
          }
        })
        .finally(() => {
          if (timeoutId !== null) clearTimeout(timeoutId);
        });
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [needsServerUrl]);

  // Fin du wizard : mémoriser, sinon le prochain lancement re-bloquerait.
  const updateSetupRequired = useCallback((value: boolean) => {
    writeSetupDone(!value);
    setSetupRequired(value);
  }, []);

  return { setupRequired, backendDown, setSetupRequired: updateSetupRequired };
}
