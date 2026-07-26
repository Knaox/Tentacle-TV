/**
 * Liste FERMÉE des canaux autorisés entre la page et le processus principal.
 *
 * C'est le remplaçant du système de capabilities de Tauri, qu'on abandonne.
 * Le preload refuse tout ce qui n'est pas ici : la page ne peut donc pas
 * inventer un canal, même si du code hostile s'y exécutait.
 *
 * Ne JAMAIS exposer `ipcRenderer` tel quel — ce serait rendre cette liste
 * inutile et transformer la moindre faille d'affichage en exécution de code.
 */

/** Commandes appelables par la page. Dérivées de l'inventaire de l'app Tauri. */
export const COMMANDS = [
  // Plein écran
  "toggle_fullscreen",
  "player_fullscreen_enter",
  "player_fullscreen_leave",

  // Session hors ligne et photo de profil
  "session_cache_get",
  "session_cache_set",
  "session_cache_clear",
  "avatar_cache_put",
  "avatar_cache_get",

  // Téléchargements — stockage
  "downloads_get_root",
  "downloads_set_root",
  "downloads_disk_free",
  "downloads_asset_base",
  "downloads_disk_usage",

  // Téléchargements — moteur
  "downloads_engine_start",
  "downloads_enqueue",
  "downloads_pause",
  "downloads_resume",
  "downloads_cancel",
  "downloads_delete",
  "downloads_list",
  "downloads_state_for_item",
  "downloads_set_auto_delete",

  // Lecture locale
  "downloads_local_source",
  "downloads_playback_set",
  "downloads_reports_pending",
  "downloads_reports_mark_synced",
  "downloads_purge_due",

  // Lecteur mpv
  "mpv_init",
  "mpv_command",
  "mpv_set_property",
  "mpv_get_property",
  "mpv_destroy",
  // Windows : la surface cesse de peindre son fond le temps de la lecture, et
  // la fenêtre enfant de mpv est désarmée pour ne jamais geler la file
  // d'entrée qu'elle partage avec le thread de l'interface.
  "player_surface_transparent",
  "mpv_harden_child_window",
  // Bascule du mode HDR de l'écran : son état pour le diagnostic, et
  // l'autorisation donnée par la préférence de l'utilisateur.
  "display_hdr_state",
  "display_hdr_auto",

  // Veille et contrôles média
  "prevent_display_sleep_start",
  "prevent_display_sleep_stop",
  "smtc_init",
  "smtc_set_playback",
  "smtc_set_metadata",
  "smtc_clear",
  "set_audio_session_name",

  // Mises à jour (Microsoft Store)
  "check_msix_update",
  "download_and_install_msix_update",

  // Greffons — dépôt du document à servir sous son origine dédiée.
  // Propre à Electron : Tauri monte les greffons en `srcdoc`, la question de
  // l'origine ne s'y pose pas de la même façon.
  "plugin_document_set",
] as const;

/** Évènements que le processus principal peut pousser vers la page. */
export const EVENTS = [
  "mpv://event",
  "mpv://property-change",
  "downloads://progress",
  "downloads://changed",
  "window://fullscreen",
  "smtc-button",
  "msix-update-progress",
] as const;

export type Command = (typeof COMMANDS)[number];
export type EventName = (typeof EVENTS)[number];

const COMMAND_SET: ReadonlySet<string> = new Set(COMMANDS);
const EVENT_SET: ReadonlySet<string> = new Set(EVENTS);

export function isAllowedCommand(name: string): name is Command {
  return COMMAND_SET.has(name);
}

export function isAllowedEvent(name: string): name is EventName {
  return EVENT_SET.has(name);
}
