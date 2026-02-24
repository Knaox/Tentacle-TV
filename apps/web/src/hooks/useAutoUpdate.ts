import { useState, useEffect, useCallback } from "react";
import { isTauri } from "./useDesktopPlayer";

export interface UpdateInfo {
  available: boolean;
  version?: string;
  notes?: string;
  downloading: boolean;
  progress: number;
  error: string | null;
}

const defaultInfo: UpdateInfo = {
  available: false,
  downloading: false,
  progress: 0,
  error: null,
};

export function useAutoUpdate() {
  const [info, setInfo] = useState<UpdateInfo>(defaultInfo);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;

    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();

        if (cancelled || !update) return;

        setInfo((prev) => ({
          ...prev,
          available: true,
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

    setInfo((prev) => ({ ...prev, downloading: true, progress: 0, error: null }));

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
          setInfo((prev) => ({ ...prev, progress: 100 }));
        }
      });

      // Relaunch after install
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
