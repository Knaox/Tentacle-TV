/**
 * Les formes d'évènements mpv que le lecteur lit.
 *
 * Elles venaient du paquet `tauri-plugin-libmpv-api`, désinstallé avec la
 * coquille Tauri. Recopiées ici parce que ce sont des formes de DONNÉES — ce
 * que libmpv met dans sa file d'évènements — et non une API de bibliothèque :
 * elles ne dépendaient de ce paquet que par accident d'historique.
 *
 * ⚠️ La coquille Electron relaie `reason` et `error` tels que libmpv les émet :
 * des NOMBRES (`mpvDrain.ts` décode la struct `mpv_event_end_file` et n'y
 * traduit rien). L'ancien type en chaînes venait du plugin Rust de Tauri, qui
 * convertissait de son côté — plus personne ne convertit. Mesuré le 28.08 :
 * un fichier local illisible sort `end-file` avec `reason = 4`.
 */

/**
 * Raisons de fin de fichier — valeurs de `mpv_end_file_reason` relevées dans
 * `client.h` de mpv v0.41 (la valeur 1 n'existe pas, elle est sautée).
 */
export const MPV_END_FILE_REASON = {
  EOF: 0,
  STOP: 2,
  QUIT: 3,
  ERROR: 4,
  REDIRECT: 5,
} as const;

/**
 * Codes `mpv_error` utiles au lecteur — relevés dans `client.h` de mpv v0.41.
 *
 * ⚠️ `LOADING_FAILED` est AMBIGU (mesuré) : il sort pour un fichier local
 * disparu (erreur de média) COMME pour un protocole absent de la chaîne
 * (défaut de lecteur — le cas https sans TLS du 28.08). Le code seul ne suffit
 * jamais à classer un échec ; voir `hooks/playbackFailure.ts`.
 */
export const MPV_ERROR = {
  LOADING_FAILED: -13,
  NOTHING_TO_PLAY: -16,
  UNKNOWN_FORMAT: -17,
} as const;

/**
 * Fin de lecture d'un fichier.
 *
 * ⚠️ `reason` décide si l'on enchaîne : seul `EOF` (0) est une vraie fin. Un
 * `loadfile` qui remplace la lecture en cours produit un `STOP` (2), et le
 * confondre avec une fin ferait passer à l'épisode suivant à chaque changement
 * de piste. `error` n'a de sens que si `reason` vaut `ERROR` (4).
 */
export interface MpvEndFileEvent {
  event: string;
  reason: number;
  error?: number;
  playlist_entry_id?: number;
  playlist_insert_id?: number;
  playlist_insert_num_entries?: number;
}
