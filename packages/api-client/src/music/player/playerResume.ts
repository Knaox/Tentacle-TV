/**
 * Octave — le dernier titre et la file, gardés sur l'appareil PAR IDENTITÉ (`tentacle_octave_player` : des titres
 * tels que les listes les montrent, jamais une URL de source) et repris en pause à l'ouverture du lecteur
 * (`restorePlayback`, shared). Écrit aux TRANSITIONS — changement de titre ou de file, pause, app qui passe en
 * arrière-plan — et, pendant l'écoute seulement, au plus toutes les 30 s (lot « bat » : une fermeture brutale perd
 * au plus cela). Une écriture ne relit ni ne réécrit tout le stockage (`playerResumeStore.ts`). Le même pour le
 * web, le bureau et le mobile : chaque client donne son stockage synchrone et son signal « l'app se cache » (`onHide`).
 *
 * La reprise ne vaut que DANS LE MÊME LANCEMENT (`launchId`, règle du 29/10) : quitter Octave puis y revenir, un
 * rechargement de la page, un hôte JS rechargé la retrouvent ; l'application fermée pour de bon (balayée, quittée
 * au bureau, onglet fermé) repart de zéro — une session gardée par un lancement précédent est ignorée.
 * Clé de stockage : elle ne se renomme jamais.
 */

import { restorePlayback, savePlayback, type OctavePlayer, type SavedPlayback, type SyncStorage } from "@tentacle-tv/shared/octave";
import { createPlayerResumeWriter, OCTAVE_PLAYER_KEY, parseStoredPlayers } from "./playerResumeStore";

export { OCTAVE_PLAYER_KEY };
/** Pendant l'écoute, la position s'écrit au plus à ce rythme (une fermeture brutale perd au plus cela). */
const PLAYING_SAVE_MS = 30_000;
/** Un changement de file s'écrit une fois au repos. */
const CHANGE_SAVE_MS = 800;

/** Le lancement de CE moteur JS : un repli pour qui n'a pas mieux (le mobile demande au natif, le web à l'onglet). */
const JS_LAUNCH = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface PlayerResumeDeps {
  storage: SyncStorage & { removeItem?: (key: string) => void };
  /** L'identité de la session EN COURS (jamais écrire au nom d'une session partie). */
  ownerNow: () => string | null;
  /** Abonne `save` au passage de l'app en arrière-plan ; rend le désabonnement. */
  onHide: (save: () => void) => () => void;
  /**
   * Le lancement en cours : il change quand l'application est fermée pour de bon. Défaut : ce moteur JS (un
   * rechargement compte comme un nouveau lancement).
   */
  launchId?: () => string;
  now?: () => number;
}

/** La session gardée de cette identité ; avec `launch`, seulement si elle a été gardée par CE lancement. */
export function readSavedPlayback(storage: SyncStorage, owner: string, launch?: string): SavedPlayback | null {
  const entry = parseStoredPlayers(storage.getItem(OCTAVE_PLAYER_KEY))[owner];
  if (!entry || (launch !== undefined && entry.launch !== launch)) return null;
  return entry.playback ?? null;
}

/**
 * Reprend la session gardée de cette identité dans le lecteur neuf, puis la tient à jour. Rend la fonction de
 * détachement (qui écrit une dernière fois).
 */
export function attachPlayerResume(player: OctavePlayer, owner: string | null, deps: PlayerResumeDeps): () => void {
  if (owner === null) return () => undefined;
  const now = deps.now ?? Date.now;
  const launchId = deps.launchId ?? (() => JS_LAUNCH);
  restorePlayback(player, readSavedPlayback(deps.storage, owner, launchId()));

  const writer = createPlayerResumeWriter(deps.storage);
  const save = () => {
    if (deps.ownerNow() === owner) writer.write(owner, savePlayback(player.snapshot.get(), player.position.get().positionMs), now(), launchId());
  };
  // L'écriture régulière ne bat que pendant l'écoute : en pause, rien ne bouge, aucune raison de réveiller l'app.
  let playing: ReturnType<typeof setInterval> | null = null;
  const pace = (wantsPlay: boolean) => {
    if (wantsPlay && playing === null) playing = setInterval(save, PLAYING_SAVE_MS);
    if (!wantsPlay && playing !== null) {
      clearInterval(playing);
      playing = null;
    }
  };
  let changeTimer: ReturnType<typeof setTimeout> | null = null;
  let last = player.snapshot.get();
  pace(last.wantsPlay);
  const offSnapshot = player.snapshot.subscribe(() => {
    const next = player.snapshot.get();
    const changed = next.queue !== last.queue || next.current !== last.current || next.wantsPlay !== last.wantsPlay;
    last = next;
    if (!changed) return;
    pace(next.wantsPlay);
    if (changeTimer !== null) clearTimeout(changeTimer);
    changeTimer = setTimeout(save, CHANGE_SAVE_MS);
  });
  const offHide = deps.onHide(save);

  return () => {
    offSnapshot();
    pace(false);
    if (changeTimer !== null) clearTimeout(changeTimer);
    offHide();
    save();
  };
}
