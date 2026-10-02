import { arrivedBetween, type ArrivalState } from "./liveProgress";

/**
 * Les ARRIVÉES des demandes, sur les téléviseurs — pur. Un titre qui sort
 * d'une liste des titres attendus en avançant est arrivé (`arrivedBetween`) ;
 * l'appareil s'en souvient un temps (`keepMs`) : une carte encore à l'écran
 * dit alors « Disponible », en pleine couleur, au lieu de retomber dans le
 * gris.
 *
 * Deux listes le suivent — celle du compte (l'état des cartes) et celle des
 * TV (« Mes demandes ») —, lues à des instants différents. Chacune tient SES
 * arrivées (`nextArrivals`) : un titre que l'une montre encore, lue plus tôt,
 * n'efface pas l'arrivée qu'a vue l'autre. Les cartes lisent leur union
 * (`unionArrivals`), « Mes demandes » la sienne seulement.
 */

export interface Arrival<T> {
  /** Le titre tel qu'il était à sa dernière lecture. */
  title: T;
  /** Quand l'appareil a vu qu'il était arrivé (ms). */
  at: number;
}

export type Arrivals<T> = ReadonlyMap<string, Arrival<T>>;

/**
 * Les arrivées d'UNE liste après sa nouvelle lecture : ce qui en est sorti en
 * avançant s'y ajoute ; ce qu'elle montre de nouveau (redemandé) n'est plus
 * arrivé ; ce qui date de plus de `keepMs` s'oublie. Rien de changé : `prev`
 * lui-même, pour que l'appelant ne republie rien.
 */
export function nextArrivals<T extends { key: string; state: ArrivalState }>(
  prev: Arrivals<T>,
  before: readonly T[] | null | undefined,
  after: readonly T[],
  now: number,
  keepMs: number,
): Arrivals<T> {
  const next = new Map(prev);
  for (const title of arrivedBetween(before, after)) next.set(title.key, { title, at: now });
  for (const title of after) next.delete(title.key);
  for (const [key, arrival] of next) if (now - arrival.at > keepMs) next.delete(key);
  const same = next.size === prev.size && [...next.keys()].every((key) => prev.get(key) === next.get(key));
  return same ? prev : next;
}

/** L'union des arrivées de plusieurs listes : la plus ancienne arrivée d'un titre fait foi. */
export function unionArrivals<T>(lists: Iterable<Arrivals<T>>): Map<string, Arrival<T>> {
  const out = new Map<string, Arrival<T>>();
  for (const arrivals of lists) {
    for (const [key, arrival] of arrivals) {
      const known = out.get(key);
      if (!known || arrival.at < known.at) out.set(key, arrival);
    }
  }
  return out;
}
