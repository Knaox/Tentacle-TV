/**
 * Octave — le dernier titre et la file, gardés sur l'appareil PAR IDENTITÉ
 * (`tentacle_octave_player`, stockage local : des titres tels que les listes
 * les montrent, jamais une URL de source) et repris en pause à l'ouverture du
 * lecteur (`restorePlayback`, shared). Écrit au changement de titre ou de
 * file, à la pause, toutes les 15 s pendant l'écoute, et à la sortie de page.
 * Clé de stockage : elle ne se renomme jamais.
 */

import { restorePlayback, savePlayback, type OctavePlayer, type SavedPlayback } from "@tentacle-tv/shared/octave";
import { octaveOwner } from "./octaveOwner";

export const OCTAVE_PLAYER_KEY = "tentacle_octave_player";
/** Pendant l'écoute, la position s'écrit à ce rythme (une fermeture brutale perd au plus cela). */
const PLAYING_SAVE_MS = 15_000;
/** Un changement de file s'écrit une fois au repos. */
const CHANGE_SAVE_MS = 800;

/** Au plus tant d'identités gardées (les plus récentes), comme le cache des pages. */
const MAX_OWNERS = 4;

type StoredPlayers = Record<string, { playback: SavedPlayback | null; at: number }>;

function readAll(): StoredPlayers {
  try {
    const parsed = JSON.parse(localStorage.getItem(OCTAVE_PLAYER_KEY) ?? "null") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as StoredPlayers) : {};
  } catch {
    return {};
  }
}

function read(owner: string): SavedPlayback | null {
  return readAll()[owner]?.playback ?? null;
}

function write(owner: string, playback: SavedPlayback | null): void {
  const all = { ...readAll(), [owner]: { playback, at: Date.now() } };
  const kept = Object.entries(all)
    .sort(([, a], [, b]) => (b?.at ?? 0) - (a?.at ?? 0))
    .slice(0, MAX_OWNERS);
  try {
    localStorage.setItem(OCTAVE_PLAYER_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    /* stockage plein ou bloqué : la prochaine ouverture repartira d'une barre vide */
  }
}

export function forgetOctavePlayer(): void {
  try {
    localStorage.removeItem(OCTAVE_PLAYER_KEY);
  } catch {
    /* rien à oublier */
  }
}

/**
 * Reprend la session gardée de cette identité dans le lecteur neuf, puis la
 * tient à jour. Rend la fonction de détachement (qui écrit une dernière fois).
 */
export function attachPlayerResume(player: OctavePlayer, owner: string | null): () => void {
  if (owner === null) return () => undefined;
  restorePlayback(player, read(owner));

  // Jamais au nom d'une session qui n'est plus là (déconnexion, autre profil) : elle effacerait ou mêlerait.
  const save = () => {
    if (octaveOwner() === owner) write(owner, savePlayback(player.snapshot.get(), player.position.get().positionMs));
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
  const onHidden = () => {
    if (document.visibilityState === "hidden") save();
  };
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", onHidden);

  return () => {
    offSnapshot();
    clearInterval(playing);
    if (changeTimer !== null) clearTimeout(changeTimer);
    window.removeEventListener("pagehide", save);
    document.removeEventListener("visibilitychange", onHidden);
    save();
  };
}
