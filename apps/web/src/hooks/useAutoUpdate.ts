import { useState, useEffect, useCallback, useRef } from "react";
import { isTauri, isWindows, isLinux, isAppStoreBuild } from "./useDesktopPlayer";
import { openExternal } from "../lib/openExternal";
import { APP_STORE_ID, checkAppStoreUpdate, checkMsixUpdate } from "../lib/updateCheckers";
import { checkLinuxUpdate, downloadLinuxUpdate, applyLinuxUpdate, type LinuxUpdateFound } from "../lib/linuxUpdate";

export type UpdatePhase = "idle" | "available" | "downloading" | "installing" | "restarting";

export interface UpdateInfo {
  available: boolean;
  phase: UpdatePhase;
  version?: string;
  notes?: string;
  downloading: boolean;
  progress: number;
  error: string | null;
  /** Build Mac App Store : le bouton ouvre l'App Store au lieu d'installer. */
  isStoreUpdate: boolean;
  /** L'App Store a été ouvert (hint « cliquez sur Mettre à jour » affiché). */
  storeOpened: boolean;
  storeUrl?: string;
}

const defaultInfo: UpdateInfo = {
  available: false,
  phase: "idle",
  downloading: false,
  progress: 0,
  error: null,
  isStoreUpdate: false,
  storeOpened: false,
};

interface MsixProgress {
  progress: number; // 0.0 .. 1.0
}

// Flag de simulation activé par __tentacleSimulateUpdate() depuis la console.
// En mémoire (pas localStorage) — WebView2 peut ne pas persister localStorage
// dans certaines configs dev.
let __testMode = false;

// Re-check périodique : l'app reste souvent ouverte des jours (usage salon) —
// un check unique au démarrage ratait toute MAJ publiée ensuite. 6 h : assez
// fréquent pour être vu dans la journée, négligeable en réseau (un JSON).
const UPDATE_RECHECK_MS = 6 * 60 * 60 * 1000;

export function useAutoUpdate() {
  const [info, setInfo] = useState<UpdateInfo>(defaultInfo);
  // URL App Store mémorisée hors state pour rester dispo dans installUpdate ([]).
  const storeUrlRef = useRef<string | undefined>(undefined);
  // MAJ Linux détectée (asset + format), mémorisée hors state pour installUpdate.
  const linuxFoundRef = useRef<LinuxUpdateFound | null>(null);
  // Phase courante lisible depuis l'interval de re-check (effet monté avec []).
  const phaseRef = useRef<UpdatePhase>("idle");
  useEffect(() => { phaseRef.current = info.phase; }, [info.phase]);

  useEffect(() => {
    // Dev only — exposé sur window pour valider l'UX depuis la console.
    // Vite tree-shake `import.meta.env.DEV === false` en prod build → code retiré.
    if (import.meta.env.DEV) {
      (window as unknown as { __tentacleSimulateUpdate?: () => void }).__tentacleSimulateUpdate = () => {
        __testMode = true;
        setInfo({
          ...defaultInfo,
          available: true,
          phase: "available",
          version: "9.9.9",
          notes: "Mode test — aucune mise à jour réelle ne sera installée.\n• Validation de la pop-up\n• Progress factice 5s\n• Pas de redémarrage",
        });
      };
    }

    if (!isTauri()) return;
    if (!isAppStoreBuild() && !isWindows() && !isLinux()) return;

    let cancelled = false;

    const runCheck = async () => {
      try {
        // macOS App Store — détection via le manifest du repo (pas d'auto-update).
        if (isAppStoreBuild()) {
          const update = await checkAppStoreUpdate();
          if (cancelled || !update) return;
          storeUrlRef.current = update.storeUrl;
          setInfo((prev) => ({
            ...prev,
            available: true,
            phase: "available",
            version: update.version,
            notes: update.notes,
            isStoreUpdate: true,
            storeUrl: update.storeUrl,
          }));
          return;
        }

        // Windows — Microsoft Store : détection WinRT, version/notes par le
        // manifest (voir checkMsixUpdate — notes affichées même si le manifest
        // est en retard d'une version).
        if (isWindows()) {
          const update = await checkMsixUpdate();
          if (cancelled || !update) return;
          setInfo((prev) => ({
            ...prev,
            available: true,
            phase: "available",
            version: update.displayVersion,
            notes: update.notes,
          }));
          return;
        }

        // Linux — auto-updater intégré universel (aucun store). Détecte le format
        // installé (AppImage/deb/rpm/pacman) et l'asset correspondant sur la
        // dernière release publiée dans le manifeste.
        if (isLinux()) {
          const found = await checkLinuxUpdate();
          if (cancelled || !found) return;
          linuxFoundRef.current = found;
          setInfo((prev) => ({
            ...prev,
            available: true,
            phase: "available",
            version: found.version,
            notes: found.notes,
          }));
          return;
        }
      } catch (err) {
        console.error("[updater] check échoué:", err);
        if (!cancelled) {
          setInfo((prev) => ({ ...prev, error: String(err) }));
        }
      }
    };

    void runCheck();
    // Jamais de re-check pendant un flow en cours (modale visible, téléchargement,
    // installation) — uniquement depuis l'état de repos.
    const recheckId = setInterval(() => {
      if (phaseRef.current === "idle") void runCheck();
    }, UPDATE_RECHECK_MS);

    return () => { cancelled = true; clearInterval(recheckId); };
  }, []);

  const installUpdate = useCallback(async () => {
    if (!isTauri()) return;

    // Mode simulation : flow factice 5s, pas de relaunch réel.
    if (import.meta.env.DEV && __testMode) {
      setInfo((prev) => ({ ...prev, downloading: true, phase: "downloading", progress: 0, error: null }));
      for (let i = 1; i <= 100; i++) {
        await new Promise((r) => setTimeout(r, 50));
        setInfo((prev) => ({ ...prev, progress: i }));
      }
      setInfo((prev) => ({ ...prev, phase: "installing" }));
      await new Promise((r) => setTimeout(r, 1500));
      setInfo((prev) => ({ ...prev, phase: "restarting" }));
      await new Promise((r) => setTimeout(r, 2000));
      __testMode = false;
      setInfo(defaultInfo);
      return;
    }

    // macOS App Store — ouvre la fiche de l'app SANS quitter ni redémarrer :
    // la mise à jour se déclenche dans l'App Store (bouton « Mettre à jour »
    // sur la fiche), qui ferme l'app lui-même au moment d'installer. L'ancien
    // exit(0) fermait l'app sans MAJ — perçu comme un simple redémarrage.
    if (isAppStoreBuild()) {
      const url = storeUrlRef.current || `macappstore://apps.apple.com/app/id${APP_STORE_ID}?mt=12`;
      try {
        await openExternal(url);
        setInfo((prev) => ({ ...prev, storeOpened: true, error: null }));
      } catch (err) {
        console.error("[updater] ouverture App Store échouée:", err);
        setInfo((prev) => ({ ...prev, error: String(err) }));
      }
      return;
    }

    if (isWindows()) {
      setInfo((prev) => ({ ...prev, downloading: true, phase: "downloading", progress: 0, error: null }));
      let unlistenProgress: (() => void) | null = null;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { listen } = await import("@tauri-apps/api/event");

        unlistenProgress = await listen<MsixProgress>("msix-update-progress", (event) => {
          const pct = Math.round((event.payload.progress ?? 0) * 100);
          setInfo((prev) => ({ ...prev, progress: pct }));
        });

        await invoke("download_and_install_msix_update");
        setInfo((prev) => ({ ...prev, progress: 100, phase: "installing" }));

        // L'install MSIX s'applique au prochain démarrage — on relance.
        setInfo((prev) => ({ ...prev, phase: "restarting" }));
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch (err) {
        setInfo((prev) => ({ ...prev, downloading: false, phase: "available", error: String(err) }));
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
      setInfo((prev) => ({ ...prev, downloading: true, phase: "downloading", progress: 0, error: null }));
      try {
        const path = await downloadLinuxUpdate(found, (pct) =>
          setInfo((prev) => ({ ...prev, progress: pct })),
        );
        setInfo((prev) => ({ ...prev, progress: 100, phase: "installing" }));
        await applyLinuxUpdate(path, found.format);
      } catch (err) {
        setInfo((prev) => ({ ...prev, downloading: false, phase: "available", error: String(err) }));
      }
      return;
    }
  }, []);

  const dismiss = useCallback(() => {
    setInfo(defaultInfo);
  }, []);

  return { ...info, installUpdate, dismiss };
}
