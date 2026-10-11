import { useCallback, useEffect, useRef, useState } from "react";
import type { SetupJellyfinInstall, SetupJellyfinStart, SetupLocalJellyfin } from "@tentacle-tv/shared";
import { installRunning } from "./localJellyfinModel";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";

/** Pendant l'installation, l'état bouge vite (téléchargement) ; ensuite, on attend que Jellyfin réponde. */
const INSTALL_POLL_MS = 1_500;
const WAIT_POLL_MS = 3_000;
/** Rien en cours (Jellyfin à installer à la main, ou arrêté) : on regarde de temps en temps s'il est venu. */
const IDLE_POLL_MS = 15_000;

export interface LocalJellyfin {
  local: SetupLocalJellyfin | null;
  install: SetupJellyfinInstall | null;
  /** « Démarrer Jellyfin » a été demandé : on attend qu'il réponde. */
  starting: boolean;
  startRefusal: Extract<SetupJellyfinStart, { started: false }>["reason"] | null;
  error: WizardErrorCode | null;
  busy: boolean;
  refresh: () => Promise<void>;
  startInstall: () => Promise<void>;
  start: () => Promise<void>;
}

/**
 * Le Jellyfin de ce PC (app Windows) : la détection de l'hôte, l'installation
 * guidée suivie pas à pas, « Démarrer Jellyfin » — puis, dès qu'il répond,
 * `onFound` avec son adresse (une fois par adresse), pour qu'il rejoigne la
 * liste. Rien ne tourne tant que l'écran n'est pas monté.
 */
export function useLocalJellyfin(onFound: (url: string) => void): LocalJellyfin {
  const [local, setLocal] = useState<SetupLocalJellyfin | null>(null);
  const [install, setInstall] = useState<SetupJellyfinInstall | null>(null);
  const [starting, setStarting] = useState(false);
  const [startRefusal, setStartRefusal] = useState<LocalJellyfin["startRefusal"]>(null);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  const announced = useRef<string | null>(null);
  const found = useRef(onFound);
  useEffect(() => {
    found.current = onFound;
  });

  const guard = useCallback(async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    }
  }, []);

  const refresh = useCallback(() => guard(async () => setLocal(await setupApi.localJellyfin())), [guard]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (local?.state !== "running") return;
    setStarting(false);
    if (announced.current === local.url) return;
    announced.current = local.url;
    found.current(local.url);
  }, [local]);

  // L'installation avance : son état ; finie, ou un démarrage demandé : la détection, plus souvent,
  // jusqu'à ce qu'il réponde ; sinon, de temps en temps (installé à la main, démarré dans Services).
  const running = installRunning(install);
  const known = local !== null;
  const answered = local?.state === "running";
  const waiting = starting || install?.phase === "done";
  useEffect(() => {
    if (!known || answered) return;
    const timer = setInterval(() => {
      if (running) void guard(async () => setInstall(await setupApi.installStatus()));
      else void refresh();
    }, running ? INSTALL_POLL_MS : waiting ? WAIT_POLL_MS : IDLE_POLL_MS);
    return () => clearInterval(timer);
  }, [known, answered, running, waiting, guard, refresh]);

  const act = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      await guard(action);
      setBusy(false);
    },
    [guard],
  );

  return {
    local,
    install,
    starting,
    startRefusal,
    error,
    busy,
    refresh,
    startInstall: () => act(async () => setInstall(await setupApi.installJellyfin())),
    start: () =>
      act(async () => {
        const result = await setupApi.startJellyfin();
        setStartRefusal(result.started ? null : result.reason);
        setStarting(result.started);
      }),
  };
}
