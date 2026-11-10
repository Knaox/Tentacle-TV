/**
 * Octave — une RAFALE d'évènements ne relit qu'une fois par fenêtre (lot « pg », 10/11). Une playlist importée de
 * 9 000 titres fait venir ses absents un à un : un `music:resolved` par titre relisait chaque fois la liste d'attente
 * ENTIÈRE du compte (9 Mo mesurés côté Sillon) et la playlist, et chaque relecture annulait la précédente en vol.
 *
 * Le premier évènement relit tout de suite (rien ne change pour un geste isolé) ; les suivants, dans la fenêtre, ne
 * font qu'UNE relecture à sa fin.
 */

export const EVENT_COALESCE_MS = 2_000;

type Window = { until: number; trailing: ReturnType<typeof setTimeout> | null; run: () => void };

/** Les fenêtres de chaque propriétaire (un client de requêtes) : deux clients ne se retiennent jamais l'un l'autre. */
const owners = new WeakMap<object, Map<string, Window>>();

/** `run` maintenant si la fenêtre de (`owner`, `key`) est libre ; sinon une seule fois, à la fin de la fenêtre. */
export function coalesced(owner: object, key: string, run: () => void, windowMs: number = EVENT_COALESCE_MS, now: () => number = Date.now): void {
  let windows = owners.get(owner);
  if (!windows) owners.set(owner, (windows = new Map()));
  const open = windows.get(key);
  const t = now();
  if (!open || t >= open.until) {
    if (open?.trailing) clearTimeout(open.trailing);
    windows.set(key, { until: t + windowMs, trailing: null, run });
    run();
    return;
  }
  open.run = run;
  if (open.trailing) return;
  const own = windows;
  open.trailing = setTimeout(() => {
    const latest = own.get(key)?.run ?? run;
    own.set(key, { until: now() + windowMs, trailing: null, run: latest });
    latest();
  }, Math.max(0, open.until - t));
}
