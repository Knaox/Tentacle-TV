/**
 * Les formes d'évènements mpv que le lecteur lit.
 *
 * Elles venaient du paquet `tauri-plugin-libmpv-api`, désinstallé avec la
 * coquille Tauri. Recopiées ici parce que ce sont des formes de DONNÉES — ce
 * que libmpv met dans sa file d'évènements — et non une API de bibliothèque :
 * elles ne dépendaient de ce paquet que par accident d'historique.
 */

/** Raisons de fin de fichier, telles que libmpv les nomme. */
export type MpvEndFileReason = "eof" | "stop" | "quit" | "error" | "redirect" | "unknown";

/**
 * Fin de lecture d'un fichier.
 *
 * ⚠️ `reason` décide si l'on enchaîne : seul `eof` est une vraie fin. Un
 * `loadfile` qui remplace la lecture en cours produit un `stop`, et le
 * confondre avec une fin ferait passer à l'épisode suivant à chaque changement
 * de piste.
 */
export interface MpvEndFileEvent {
  event: string;
  reason: MpvEndFileReason;
  error?: number;
  playlist_entry_id?: number;
  playlist_insert_id?: number;
  playlist_insert_num_entries?: number;
}
