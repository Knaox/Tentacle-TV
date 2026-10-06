import { useEffect, useState } from "react";
import type { OutageNotice } from "@tentacle-tv/api-client";

/**
 * Le compte à rebours du message d'une panne de Jellyfin sur les
 * téléviseurs (`useOutageNotice`, la règle des lecteurs) : les secondes qui
 * restent, une à la fois ; à zéro, le message est fini pour cette occasion.
 * Rien ne tourne sans message. `null` : aucun message à décompter.
 */
export function useOutageNoticeCountdown(notice: OutageNotice | null): number | null {
  const occasion = notice?.occasion ?? null;
  const durationMs = notice?.durationMs ?? 0;
  const done = notice?.done;
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (occasion === null || !done) {
      setLeft(null);
      return undefined;
    }
    const endsAt = Date.now() + durationMs;
    const tick = () => {
      const ms = endsAt - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) done();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [occasion, durationMs, done]);

  return occasion === null ? null : left;
}
