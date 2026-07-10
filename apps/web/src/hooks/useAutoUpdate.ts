import { useState, useEffect, useCallback, useRef } from "react";
import { isTauri, isWindows, isLinux, isAppStoreBuild } from "./useDesktopPlayer";
import { openExternal } from "../lib/openExternal";
import { fetchStoreVersions, pickManifestNotes } from "../lib/storeVersions";
import { checkLinuxUpdate, downloadLinuxUpdate, applyLinuxUpdate, type LinuxUpdateFound } from "../lib/linuxUpdate";

/** Fiche App Store (achat universel iOS+macOS) — repli si absent du manifest. */
const APP_STORE_ID = "6760205634";

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
  storeUrl?: string;
}

const defaultInfo: UpdateInfo = {
  available: false,
  phase: "idle",
  downloading: false,
  progress: 0,
  error: null,
  isStoreUpdate: false,
};

/** Compare deux versions semver simples ("1.2.3"). true si `a` > `b`. */
function isNewerVersion(a: string, b: string): boolean {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/** Vérifie la dernière version macOS publiée via le manifest du repo
 *  (updates/store-versions.json). L'API iTunes Lookup ne référence PAS la
 *  fiche macOS d'une app en achat universel iOS+macOS (elle renvoie la fiche
 *  iOS ou rien) → l'ancienne détection était muette. Le manifest est maintenu
 *  à chaque bump de version desktop. */
async function checkAppStoreUpdate(): Promise<{ version: string; notes?: string; storeUrl: string } | null> {
  // Version réelle du bundle en cours (1.0.0+), pas la constante de build web.
  const { getVersion } = await import("@tauri-apps/api/app");
  const current = await getVersion();

  const manifest = await fetchStoreVersions();
  const mac = manifest?.macAppStore;
  if (!mac?.version) return null;
  if (!isNewerVersion(mac.version, current)) return null;
  return {
    version: mac.version,
    notes: pickManifestNotes(mac.notes),
    storeUrl: `macappstore://apps.apple.com/app/id${mac.appId ?? APP_STORE_ID}`,
  };
}

interface MsixUpdateInfo {
  version: string;
  mandatory: boolean;
}

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
        // macOS App Store — détection via l'API iTunes lookup (pas d'auto-update).
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

        // Windows — Microsoft Store (WinRT StoreContext). ⚠️ Le natif ne
        // connaît PAS la version de la MAJ : StorePackageUpdate.Package est le
        // package INSTALLÉ (c'était la « version actuelle » affichée à tort).
        // → détection par WinRT, version AFFICHÉE par le manifest du repo
        // (sinon pas de pastille de version, jamais la version installée).
        if (isWindows()) {
          const { invoke } = await import("@tauri-apps/api/core");
          const update = await invoke<MsixUpdateInfo | null>("check_msix_update");
          if (cancelled || !update) return;
          let displayVersion: string | undefined;
          let notes: string | undefined;
          try {
            const { getVersion } = await import("@tauri-apps/api/app");
            const current = await getVersion();
            const ms = (await fetchStoreVersions())?.microsoftStore;
            if (ms?.version && isNewerVersion(ms.version, current)) {
              displayVersion = ms.version;
              notes = pickManifestNotes(ms.notes);
            }
          } catch { /* pastille de version simplement absente */ }
          if (cancelled) return;
          setInfo((prev) => ({
            ...prev,
            available: true,
            phase: "available",
            version: displayVersion,
            notes,
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

    // macOS App Store — ouvre la fiche de l'app puis QUITTE : le Store ne peut
    // pas remplacer une app en cours d'exécution. Pas de téléchargement ni de
    // barre de progression Tentacle : la mise à jour se fait dans l'App Store,
    // l'utilisateur relance l'app à jour ensuite.
    if (isAppStoreBuild()) {
      const url = storeUrlRef.current || `macappstore://apps.apple.com/app/id${APP_STORE_ID}`;
      setInfo((prev) => ({ ...prev, phase: "restarting" }));
      try {
        await openExternal(url);
        await new Promise((r) => setTimeout(r, 800));
        const { exit } = await import("@tauri-apps/plugin-process");
        await exit(0);
      } catch (err) {
        console.error("[updater] ouverture App Store échouée:", err);
        setInfo((prev) => ({ ...prev, phase: "available", error: String(err) }));
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
