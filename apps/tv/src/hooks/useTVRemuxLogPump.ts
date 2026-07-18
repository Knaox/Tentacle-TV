import { useEffect } from "react";
import { NativeModules } from "react-native";

const Remux = (NativeModules as {
  TVLocalRemux?: { fetchLogs?: () => Promise<string[]> };
}).TVLocalRemux;

const PUMP_MS = 2000;

/**
 * Pompe des logs NATIFS du remux (tvOS, dev uniquement) : draine le ring buffer
 * TVLogBuffer (~2 s) et déverse chaque ligne [TVLR]/[TVLR-ff] dans la console
 * Metro. Monté SANS gate isLocalRemux : les logs d'un start() qui échoue puis
 * replie en transcode doivent aussi remonter. Inerte en release et sur Android
 * (module absent).
 */
export function useTVRemuxLogPump(): void {
  useEffect(() => {
    if (!__DEV__ || !Remux?.fetchLogs) return;
    let alive = true;
    const tick = () => {
      Remux.fetchLogs!()
        .then((lines) => { if (alive) for (const l of lines ?? []) console.log(l); })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, PUMP_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);
}
