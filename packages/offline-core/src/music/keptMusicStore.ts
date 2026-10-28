/**
 * Octave — la musique GARDÉE sur cet appareil, pour le compte de l'appareil : la
 * liste que tient le moteur, relue à chaque « quelque chose a changé », la
 * progression suivie en direct. Le MÊME magasin pour le bureau (IPC) et le mobile
 * (appel direct) : seul le port change. Lu SANS React par le lecteur (la copie
 * gardée d'abord) et par l'interface (`useSyncExternalStore`).
 *
 * Le hors ligne appartient au COMPTE DE L'APPAREIL : la liste est toujours la
 * sienne, jamais celle d'un profil ouvert.
 *
 * Un titre qui a CHANGÉ D'IDENTITÉ chez l'extension depuis qu'il a été gardé
 * (`keptRenames.ts`) est trouvé sous sa clé d'aujourd'hui : `byKey` la mène à la
 * copie gardée sous l'ancienne tant que la tenue à jour ne l'a pas regardée sous
 * la nouvelle.
 */

import type { KeptMusicCollection, KeptMusicTrack } from "../core/musicLibrary";

export interface KeptMusicState {
  /** La liste a été lue au moins une fois (sinon « on ne sait pas encore »). */
  loaded: boolean;
  userId: string | null;
  tracks: readonly KeptMusicTrack[];
  collections: readonly KeptMusicCollection[];
  byKey: ReadonlyMap<string, KeptMusicTrack>;
}

export interface KeptMusicPort {
  /** La plateforme sait-elle garder la musique ? Sinon le magasin reste vide et muet. */
  enabled(): boolean;
  /** Le compte de l'appareil ; `null` : personne (la liste est vide). */
  ownerUserId(): string | null;
  list(userId: string): Promise<{ tracks: KeptMusicTrack[]; collections: KeptMusicCollection[] }>;
  /** Branche les évènements du moteur (une fois). */
  listen(onChanged: () => void, onProgress: (fileId: number, bytesDone: number, expectedSize: number | null) => void): void;
}

export interface KeptMusicStore {
  state(): KeptMusicState;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  start(): void;
  setRenames(next: ReadonlyMap<string, readonly string[]>): void;
  /** La copie COMPLÈTE de ce titre, gardée par le compte de l'appareil ; `null` sinon. */
  completeTrack(trackKey: string): KeptMusicTrack | null;
}

export const EMPTY_KEPT_MUSIC: KeptMusicState = { loaded: false, userId: null, tracks: [], collections: [], byKey: new Map() };

/** Ce qu'une rangée montre d'un titre gardé : inchangé, l'objet d'avant est gardé (la rangée ne se redessine pas). */
function sameShown(a: KeptMusicTrack, b: KeptMusicTrack): boolean {
  return a.fileId === b.fileId && a.status === b.status && a.bytesDone === b.bytesDone && a.expectedSize === b.expectedSize
    && a.preparing === b.preparing
    && a.errorCode === b.errorCode && a.pausedByUser === b.pausedByUser && a.coverRel === b.coverRel;
}

function reconcile(previous: ReadonlyMap<string, KeptMusicTrack>, tracks: readonly KeptMusicTrack[]): KeptMusicTrack[] {
  return tracks.map((t) => {
    const before = previous.get(t.trackKey);
    return before && before.trackKey === t.trackKey && sameShown(before, t) ? before : t;
  });
}

const live = (k: KeptMusicTrack | undefined): k is KeptMusicTrack => !!k && k.status !== "canceled";

const sameFormers = (a: ReadonlyMap<string, readonly string[]>, b: ReadonlyMap<string, readonly string[]>): boolean =>
  a.size === b.size && [...a].every(([k, v]) => { const w = b.get(k); return !!w && w.length === v.length && v.every((x, i) => x === w[i]); });

export function createKeptMusicStore(port: KeptMusicPort): KeptMusicStore {
  let state: KeptMusicState = EMPTY_KEPT_MUSIC;
  /** La clé MONTRÉE aujourd'hui → les clés d'hier sous lesquelles sa copie a pu être gardée. */
  let formerOf: ReadonlyMap<string, readonly string[]> = new Map();
  let started = false;
  let inFlight: Promise<void> | null = null;
  let again = false;
  const listeners = new Set<() => void>();

  const publish = (next: KeptMusicState): void => {
    state = next;
    for (const listener of listeners) listener();
  };

  /** Chaque titre sous sa clé ; un titre renommé, sous sa clé d'aujourd'hui, mène à la copie d'hier (la sienne d'abord). */
  const indexed = (tracks: readonly KeptMusicTrack[]): Map<string, KeptMusicTrack> => {
    const byKey = new Map(tracks.map((t) => [t.trackKey, t]));
    for (const [shown, formers] of formerOf) {
      if (live(byKey.get(shown))) continue;
      const copy = formers.map((f) => byKey.get(f)).find(live);
      if (copy) byKey.set(shown, copy);
    }
    return byKey;
  };

  const withTracks = (userId: string, tracks: readonly KeptMusicTrack[], collections: readonly KeptMusicCollection[]): KeptMusicState =>
    ({ loaded: true, userId, tracks, collections, byKey: indexed(tracks) });

  /** Relit la liste du compte de l'appareil ; une relecture demandée pendant une autre la suit (jamais deux à la fois). */
  const refresh = (): Promise<void> => {
    if (!port.enabled()) return Promise.resolve();
    if (inFlight) {
      again = true;
      return inFlight;
    }
    const userId = port.ownerUserId();
    if (!userId) {
      publish({ ...EMPTY_KEPT_MUSIC, loaded: true });
      return Promise.resolve();
    }
    inFlight = port
      .list(userId)
      .then((list) => publish(withTracks(userId, reconcile(state.byKey, list.tracks), list.collections)))
      .catch(() => {
        // Base indisponible : ce qu'on savait reste vrai.
        if (!state.loaded) publish({ ...EMPTY_KEPT_MUSIC, loaded: true, userId });
      })
      .finally(() => {
        inFlight = null;
        if (again) {
          again = false;
          void refresh();
        }
      });
    return inFlight;
  };

  /** La progression d'un transfert : la rangée et la vue avancent sans relire la liste. */
  const onProgress = (fileId: number, bytesDone: number, expectedSize: number | null): void => {
    const index = state.tracks.findIndex((t) => t.fileId === fileId);
    if (index < 0 || state.userId === null) return;
    const tracks = [...state.tracks];
    const current = tracks[index]!;
    // Des octets arrivent : la préparation est finie.
    tracks[index] = { ...current, status: "downloading", preparing: false, bytesDone, expectedSize: expectedSize ?? current.expectedSize };
    publish(withTracks(state.userId, tracks, state.collections));
  };

  const start = (): void => {
    if (started || !port.enabled()) return;
    started = true;
    port.listen(() => void refresh(), onProgress);
    void refresh();
  };

  return {
    state: () => state,
    subscribe(listener) {
      start();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    start,
    setRenames(next) {
      if (sameFormers(formerOf, next)) return;
      formerOf = next;
      if (state.loaded && state.userId !== null) publish(withTracks(state.userId, state.tracks, state.collections));
    },
    completeTrack(trackKey) {
      const kept = state.byKey.get(trackKey);
      return kept && kept.status === "complete" ? kept : null;
    },
  };
}
