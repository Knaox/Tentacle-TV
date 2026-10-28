/**
 * Octave — le dernier titre et la file, gardés sur l'appareil PAR IDENTITÉ (`tentacle_octave_player` : des titres
 * tels que les listes les montrent, jamais une URL de source) et repris en pause à l'ouverture du lecteur
 * (`restorePlayback`, shared). Écrit au changement de titre ou de file, à la pause, toutes les 15 s pendant
 * l'écoute, et quand l'app passe en arrière-plan. Le même pour le web, le bureau et le mobile : chaque client
 * donne son stockage synchrone et son signal « l'app se cache » (`onHide`).
 * Clé de stockage : elle ne se renomme jamais.
 */

import { restorePlayback, savePlayback, type OctavePlayer, type SavedPlayback, type SyncStorage } from "@tentacle-tv/shared/octave";

export const OCTAVE_PLAYER_KEY = "tentacle_octave_player";
/** Pendant l'écoute, la position s'écrit à ce rythme (une fermeture brutale perd au plus cela). */
const PLAYING_SAVE_MS = 15_000;
/** Un changement de file s'écrit une fois au repos. */
const CHANGE_SAVE_MS = 800;
/** Au plus tant d'identités gardées (les plus récentes), comme le cache des pages. */
const MAX_OWNERS = 4;

type StoredPlayers = Record<string, { playback: SavedPlayback | null; at: number }>;

export interface PlayerResumeDeps {
  storage: SyncStorage & { removeItem?: (key: string) => void };
  /** L'identité de la session EN COURS (jamais écrire au nom d'une session partie). */
  ownerNow: () => string | null;
  /** Abonne `save` au passage de l'app en arrière-plan ; rend le désabonnement. */
  onHide: (save: () => void) => () => void;
  now?: () => number;
}

function readAll(storage: SyncStorage): StoredPlayers {
  try {
    const parsed = JSON.parse(storage.getItem(OCTAVE_PLAYER_KEY) ?? "null") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as StoredPlayers) : {};
  } catch {
    return {};
  }
}

export function readSavedPlayback(storage: SyncStorage, owner: string): SavedPlayback | null {
  return readAll(storage)[owner]?.playback ?? null;
}

function write(storage: SyncStorage, owner: string, playback: SavedPlayback | null, at: number): void {
  const all = { ...readAll(storage), [owner]: { playback, at } };
  const kept = Object.entries(all)
    .sort(([, a], [, b]) => (b?.at ?? 0) - (a?.at ?? 0))
    .slice(0, MAX_OWNERS);
  try {
    storage.setItem(OCTAVE_PLAYER_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    /* stockage plein ou bloqué : la prochaine ouverture repartira d'une barre vide */
  }
}

/**
 * Reprend la session gardée de cette identité dans le lecteur neuf, puis la tient à jour. Rend la fonction de
 * détachement (qui écrit une dernière fois).
 */
export function attachPlayerResume(player: OctavePlayer, owner: string | null, deps: PlayerResumeDeps): () => void {
  if (owner === null) return () => undefined;
  const now = deps.now ?? Date.now;
  restorePlayback(player, readSavedPlayback(deps.storage, owner));

  const save = () => {
    if (deps.ownerNow() === owner) write(deps.storage, owner, savePlayback(player.snapshot.get(), player.position.get().positionMs), now());
  };
  let changeTimer: ReturnType<typeof setTimeout> | null = null;
  let last = player.snapshot.get();
  const offSnapshot = player.snapshot.subscribe(() => {
    const next = player.snapshot.get();
    const changed = next.queue !== last.queue || next.current !== last.current || next.wantsPlay !== last.wantsPlay;
    last = next;
    if (!changed) return;
    if (changeTimer !== null) clearTimeout(changeTimer);
    changeTimer = setTimeout(save, CHANGE_SAVE_MS);
  });
  const playing = setInterval(() => {
    if (player.snapshot.get().wantsPlay) save();
  }, PLAYING_SAVE_MS);
  const offHide = deps.onHide(save);

  return () => {
    offSnapshot();
    clearInterval(playing);
    if (changeTimer !== null) clearTimeout(changeTimer);
    offHide();
    save();
  };
}
