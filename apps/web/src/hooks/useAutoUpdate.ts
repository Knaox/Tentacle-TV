import { useState, useEffect, useCallback, useRef } from "react";
import { isTauri, isWindows, isAppStoreBuild } from "./useDesktopPlayer";
import { openExternal } from "../lib/openExternal";

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

/** Vérifie la dernière version publiée sur le Mac App Store via l'API iTunes
 *  lookup. Renvoie { version, notes, storeUrl } si une MAJ est disponible. */
async function checkAppStoreUpdate(): Promise<{ version: string; notes?: string; storeUrl?: string } | null> {
  // Version réelle du bundle en cours (1.0.0+), pas la constante de build web.
  const { getVersion } = await import("@tauri-apps/api/app");
  const current = await getVersion();

  // App unifiée iOS+macOS sous com.tentacle.mobile → entity=macSoftware cible la
  // version macOS (sinon le lookup renverrait la version iOS).
  const region = (navigator.language?.split("-")[1] || "us").toLowerCase();
  const url = `https://itunes.apple.com/lookup?bundleId=com.tentacle.mobile&entity=macSoftware&country=${region}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const app = data?.results?.[0];
  if (!app?.version) return null;
  if (!isNewerVersion(app.version, current)) return null;
  return { version: app.version, notes: app.releaseNotes, storeUrl: app.trackViewUrl };
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

export function useAutoUpdate() {
  const [info, setInfo] = useState<UpdateInfo>(defaultInfo);
  // URL App Store mémorisée hors state pour rester dispo dans installUpdate ([]).
  const storeUrlRef = useRef<string | undefined>(undefined);

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
    if (!isAppStoreBuild() && !isWindows()) return;

    let cancelled = false;

    (async () => {
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

        // Windows — Microsoft Store (WinRT StoreContext)
        if (isWindows()) {
          const { invoke } = await import("@tauri-apps/api/core");
          const update = await invoke<MsixUpdateInfo | null>("check_msix_update");
          if (cancelled || !update) return;
          setInfo((prev) => ({
            ...prev,
            available: true,
            phase: "available",
            version: update.version,
          }));
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setInfo((prev) => ({ ...prev, error: String(err) }));
        }
      }
    })();

    return () => { cancelled = true; };
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

    // macOS App Store — on ouvre l'App Store (pas d'installation in-app).
    if (isAppStoreBuild()) {
      const url = storeUrlRef.current || "macappstore://apps.apple.com";
      await openExternal(url);
      setInfo(defaultInfo);
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
  }, []);

  const dismiss = useCallback(() => {
    setInfo(defaultInfo);
  }, []);

  return { ...info, installUpdate, dismiss };
}
