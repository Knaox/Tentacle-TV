import { useState, useEffect, useCallback, useRef } from "react";
import { isTauri, isWindows, isLinux, isAppStoreBuild } from "./useDesktopPlayer";
import { openExternal } from "../lib/openExternal";
import { invoke, listen, relaunch, supportsAppUpdates } from "../desktop/bridge";
import { APP_STORE_ID, appStoreUrlFor, checkAppStoreUpdate, checkMsixUpdate } from "../lib/updateCheckers";
import { checkLinuxUpdate, downloadLinuxUpdate, applyLinuxUpdate, type LinuxUpdateFound } from "../lib/linuxUpdate";
import { defaultUpdateInfo, type UpdateInfo, type UpdatePhase } from "../lib/updateTypes";
import {
  isSimulatingUpdate, runSimulatedInstall, simulatedChannel, simulatedUpdate, stopSimulatingUpdate,
  updateDebugEnabled,
} from "../lib/updateSimulation";

export type { UpdateInfo, UpdatePhase } from "../lib/updateTypes";

interface MsixProgress {
  progress: number; // 0.0 .. 1.0
  /** La coquille annonce ne pas connaître l'avancement (Microsoft Store). */
  indeterminate?: boolean;
}

// Re-check périodique : l'app reste souvent ouverte des jours (usage salon) —
// un check unique au démarrage ratait toute MAJ publiée ensuite. 6 h : assez
// fréquent pour être vu dans la journée, négligeable en réseau (un JSON).
const UPDATE_RECHECK_MS = 6 * 60 * 60 * 1000;

export function useAutoUpdate() {
  const [info, setInfo] = useState<UpdateInfo>(defaultUpdateInfo);
  // URL App Store mémorisée hors state pour rester dispo dans installUpdate ([]).
  const storeUrlRef = useRef<string | undefined>(undefined);
  // MAJ Linux détectée (asset + format), mémorisée hors state pour installUpdate.
  const linuxFoundRef = useRef<LinuxUpdateFound | null>(null);
  // Phase courante lisible depuis l'interval de re-check (effet monté avec []).
  const phaseRef = useRef<UpdatePhase>("idle");
  useEffect(() => { phaseRef.current = info.phase; }, [info.phase]);

  const patch = useCallback((next: Partial<UpdateInfo>) => {
    setInfo((prev) => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    // Crochet du panneau de diagnostic (touche U) — et de la console. La garde
    // couvre le développement ET la coquille Electron de développement, qui sert
    // un build de production : `import.meta.env.DEV` y est FAUX, et ce crochet
    // n'existait donc pas là où il sert le plus.
    // `override` : forcer une phase (`downloading`, `installing`, une erreur…)
    // pour la REGARDER — sur ce poste la simulation prend le canal store et
    // n'y passe jamais d'elle-même. Un état posé, pas une logique de plus.
    if (updateDebugEnabled()) {
      (window as unknown as {
        __tentacleSimulateUpdate?: (override?: Partial<UpdateInfo>) => void;
      }).__tentacleSimulateUpdate = (override) => {
        setInfo({ ...simulatedUpdate(defaultUpdateInfo), ...override });
      };
    }

    if (!isTauri()) return;
    // Le shell doit savoir vérifier les mises à jour. Sur un build App Store la
    // réponse est oui d'office : la détection est un manifeste HTTP et l'action
    // une ouverture d'URL (cf. `supportsAppUpdates`).
    if (!supportsAppUpdates()) return;
    if (!isAppStoreBuild() && !isWindows() && !isLinux()) return;

    let cancelled = false;

    const runCheck = async () => {
      try {
        // macOS App Store — détection via le manifest du repo (pas d'auto-update).
        if (isAppStoreBuild()) {
          const update = await checkAppStoreUpdate();
          if (cancelled || !update) return;
          storeUrlRef.current = update.storeUrl;
          patch({
            available: true,
            phase: "available",
            version: update.version,
            notes: update.notes,
            isStoreUpdate: true,
            storeUrl: update.storeUrl,
          });
          return;
        }

        // Windows — Microsoft Store : détection WinRT, version/notes par le
        // manifest (voir checkMsixUpdate — notes affichées même si le manifest
        // est en retard d'une version).
        if (isWindows()) {
          const update = await checkMsixUpdate();
          if (cancelled || !update) return;
          patch({
            available: true,
            phase: "available",
            version: update.displayVersion,
            notes: update.notes,
          });
          return;
        }

        // Linux — auto-updater intégré universel (aucun store). Détecte le format
        // installé (AppImage/deb/rpm/pacman) et l'asset correspondant sur la
        // dernière release publiée dans le manifeste.
        if (isLinux()) {
          const found = await checkLinuxUpdate();
          if (cancelled || !found) return;
          linuxFoundRef.current = found;
          patch({ available: true, phase: "available", version: found.version, notes: found.notes });
        }
      } catch (err) {
        console.error("[updater] check échoué:", err);
        if (!cancelled) patch({ error: String(err) });
      }
    };

    void runCheck();
    // Jamais de re-check pendant un flow en cours (modale visible, téléchargement,
    // installation) — uniquement depuis l'état de repos.
    const recheckId = setInterval(() => {
      if (phaseRef.current === "idle") void runCheck();
    }, UPDATE_RECHECK_MS);

    return () => { cancelled = true; clearInterval(recheckId); };
  }, [patch]);

  const installUpdate = useCallback(async () => {
    // AVANT les gardes de shell : sur un build de développement, ni le canal
    // App Store ni la commande MSIX n'existent, et le bouton de la pop-up de
    // démonstration serait resté inerte — c'est-à-dire indémontrable.
    if (isSimulatingUpdate()) {
      // macOS : on ouvre POUR DE BON la fiche de l'App Store. C'est tout l'objet
      // de la démonstration — vérifier que le lien aboutit sur la bonne fiche,
      // dans l'application App Store et pas dans un navigateur. Le canal imité
      // est celui de la plateforme (cf. simulatedChannel) : Linux n'est pas
      // « tout ce qui n'est pas Windows ».
      const url = storeUrlRef.current ?? appStoreUrlFor(APP_STORE_ID);
      if (simulatedChannel() === "appStore") {
        try {
          await openExternal(url);
          patch({ storeOpened: true, error: null });
        } catch (err) {
          patch({ error: String(err) });
        }
        return;
      }
      await runSimulatedInstall(patch, () => setInfo(defaultUpdateInfo));
      return;
    }

    if (!isTauri() || !supportsAppUpdates()) return;

    // macOS App Store — ouvre la fiche de l'app SANS quitter ni redémarrer :
    // la mise à jour se déclenche dans l'App Store (bouton « Mettre à jour »
    // sur la fiche), qui ferme l'app lui-même au moment d'installer. L'ancien
    // exit(0) fermait l'app sans MAJ — perçu comme un simple redémarrage.
    if (isAppStoreBuild()) {
      const url = storeUrlRef.current ?? appStoreUrlFor(APP_STORE_ID);
      try {
        await openExternal(url);
        patch({ storeOpened: true, error: null });
      } catch (err) {
        console.error("[updater] ouverture App Store échouée:", err);
        patch({ error: String(err) });
      }
      return;
    }

    if (isWindows()) {
      // Barre indéterminée par défaut : la coquille Electron ne sait pas où en
      // est le Store (cf. `UpdateInfo.indeterminate`). Le natif Tauri, lui, émet
      // de vraies valeurs et la remet à faux dès la première.
      patch({ downloading: true, phase: "downloading", progress: 0, indeterminate: true, error: null });
      let unlistenProgress: (() => void) | null = null;
      try {
        unlistenProgress = await listen<MsixProgress>("msix-update-progress", (event) => {
          const raw = event.payload.progress ?? 0;
          const unknown = event.payload.indeterminate === true;
          patch({ progress: Math.round(raw * 100), indeterminate: unknown });
        });

        await invoke("download_and_install_msix_update");
        patch({ progress: 100, indeterminate: false, phase: "installing" });

        // L'install MSIX s'applique au prochain démarrage — on relance.
        patch({ phase: "restarting" });
        await relaunch();
      } catch (err) {
        patch({ downloading: false, indeterminate: false, phase: "available", error: updateErrorLabel(err) });
      } finally {
        unlistenProgress?.();
      }
      return;
    }

    // Linux — téléchargement (progression) + vérif SHA256 + installation
    // (pkexec pour deb/rpm/pacman → invite polkit ; self-swap pour AppImage) +
    // relance. applyLinuxUpdate ne rend pas la main en cas de succès (relaunch).
    if (isLinux() && linuxFoundRef.current) {
      const found = linuxFoundRef.current;
      patch({ downloading: true, phase: "downloading", progress: 0, indeterminate: false, error: null });
      try {
        const path = await downloadLinuxUpdate(found, (pct) => patch({ progress: pct }));
        patch({ progress: 100, phase: "installing" });
        await applyLinuxUpdate(path, found.format);
      } catch (err) {
        patch({ downloading: false, phase: "available", error: updateErrorLabel(err) });
      }
    }
  }, [patch]);

  const dismiss = useCallback(() => {
    stopSimulatingUpdate();
    setInfo(defaultUpdateInfo);
  }, []);

  return { ...info, installUpdate, dismiss };
}

/**
 * Codes d'erreur de la coquille → clé i18n, ou message brut en dernier recours.
 *
 * La coquille lève des codes techniques (`store-page-opened`,
 * `install-state-3`…) et la modale les affichait TELS QUELS : l'utilisateur
 * lisait « Error: store-page-opened » dans sa langue de personne.
 */
function updateErrorLabel(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code = raw.replace(/^Error:\s*/, "");
  return UPDATE_ERROR_KEYS[code] ?? (UPDATE_ERROR_KEYS[code.replace(/-\d+$/, "-*")] ?? raw);
}

/** Codes connus. La modale traduit ce qui commence par `notifications:`. */
const UPDATE_ERROR_KEYS: Record<string, string> = {
  "store-page-opened": "notifications:updateStorePageOpened",
  "store-unavailable": "notifications:updateStoreUnavailable",
  "no-update": "notifications:updateNoLongerAvailable",
  "iterable-unavailable": "notifications:updateStoreUnavailable",
  "install-refused": "notifications:updateInstallRefused",
  "install-failed": "notifications:updateInstallRefused",
  "install-state-*": "notifications:updateInstallRefused",
  "aucune fenetre pour la boite de dialogue du Store": "notifications:updateStoreUnavailable",
};
