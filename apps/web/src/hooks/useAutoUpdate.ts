import { useState, useEffect, useCallback } from "react";
import { isTauri, isMacOS, isWindows } from "./useDesktopPlayer";

export type UpdatePhase = "idle" | "available" | "downloading" | "installing" | "restarting";

export interface UpdateInfo {
  available: boolean;
  phase: UpdatePhase;
  version?: string;
  notes?: string;
  downloading: boolean;
  progress: number;
  error: string | null;
}

const defaultInfo: UpdateInfo = {
  available: false,
  phase: "idle",
  downloading: false,
  progress: 0,
  error: null,
};

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
    if (!isMacOS() && !isWindows()) return;

    let cancelled = false;

    (async () => {
      try {
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

        // macOS — Tauri updater (latest.json sur GitHub)
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (cancelled || !update) return;
        setInfo((prev) => ({
          ...prev,
          available: true,
          phase: "available",
          version: update.version,
          notes: update.body ?? undefined,
        }));
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

    if (!isMacOS()) return;

    setInfo((prev) => ({ ...prev, downloading: true, phase: "downloading", progress: 0, error: null }));

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (!update) {
        setInfo((prev) => ({ ...prev, downloading: false, error: "No update found" }));
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event: any) => {
        if (event.event === "Started" && event.data.contentLength) {
          contentLength = event.data.contentLength;
        }
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const pct = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
          setInfo((prev) => ({ ...prev, progress: pct }));
        }
        if (event.event === "Finished") {
          setInfo((prev) => ({ ...prev, progress: 100, phase: "installing" }));
        }
      });

      setInfo((prev) => ({ ...prev, phase: "restarting" }));
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      setInfo((prev) => ({ ...prev, downloading: false, error: String(err) }));
    }
  }, []);

  const dismiss = useCallback(() => {
    setInfo(defaultInfo);
  }, []);

  return { ...info, installUpdate, dismiss };
}
