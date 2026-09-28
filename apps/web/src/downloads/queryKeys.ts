/**
 * Les clés des requêtes locales du hors ligne, dans un module SANS dépendance.
 *
 * Les marqueurs des cartes (`useDeviceState`) lisent la liste locale : ils ne
 * doivent pas tirer, pour une constante, la chaîne de `useDownloadState` —
 * droits, session hors ligne, et `main.tsx` —, que toute carte embarquerait.
 */
export const DOWNLOADS_LIST_QUERY_KEY = "downloads-list";
export const DOWNLOAD_STATE_QUERY_KEY = "download-state";
export const DISK_INFO_QUERY_KEY = "downloads-disk";
