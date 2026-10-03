import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerUpdate } from "./serverUpdateApi";

/**
 * La lecture de la carte, et son guet : « une fois le serveur relancé, la
 * carte le constate d'elle-même ». La commande copiée, la carte retient le
 * processus en service (`bootId`) et sa version ; la lecture se resserre
 * (cinq secondes) jusqu'à voir un autre processus — c'est le serveur revenu.
 * Même version : il a redémarré sans rien tirer de neuf (étiquette figée) ;
 * la carte le dit au lieu d'attendre pour rien. Au-delà d'un quart d'heure,
 * elle cesse de guetter : la commande n'a sans doute pas été lancée.
 *
 * Rien n'est gardé hors de la mémoire de la page : c'est un suivi, pas un réglage.
 */

const WATCH_MS = 15 * 60_000;

export type WatchOutcome =
  | { kind: "waiting" }
  | { kind: "updated"; version: string }
  | { kind: "same"; version: string };

interface Target {
  bootId: string;
  version: string;
  since: number;
}

export function useWatchedServerUpdate() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Target | null>(null);
  const [outcome, setOutcome] = useState<WatchOutcome | null>(null);
  const query = useServerUpdate({ watching: target !== null });
  const report = query.data;

  const start = useCallback(() => {
    if (!report?.bootId) return;
    setTarget((current) => current ?? { bootId: report.bootId, version: report.current, since: Date.now() });
    setOutcome({ kind: "waiting" });
  }, [report]);

  useEffect(() => {
    if (!target || !report?.bootId || report.bootId === target.bootId) return;
    setOutcome(report.current !== target.version ? { kind: "updated", version: report.current } : { kind: "same", version: report.current });
    setTarget(null);
    // Un autre serveur répond : tout ce que la page en avait lu est à relire.
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
  }, [report, target, queryClient]);

  useEffect(() => {
    if (!target) return;
    const id = setTimeout(() => {
      setTarget(null);
      setOutcome(null);
    }, Math.max(0, WATCH_MS - (Date.now() - target.since)));
    return () => clearTimeout(id);
  }, [target]);

  return { query, watching: target !== null, outcome, start };
}
