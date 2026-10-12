/**
 * The quiet notice on the page of a title Jellyfin has not found (yet)
 * (`metadata/missingMetadata.ts`), and "Rescan now" for an administrator. One
 * source for web, desktop, the mirror, mobile and TVs.
 *
 * ⚠️ Also read by MOBILE: never "download" here (guard:
 * `metadataHintVocabulary.test.ts`).
 */
export default {
  title: "Artwork and details on their way",
  body: "Artwork and details come from Jellyfin. They haven't been found for this title yet: the library may need a scan. You can already watch it.",
  rescan: "Rescan now",
  rescanning: "Starting the scan…",
  rescanStarted: "Scan started — artwork should arrive within a few minutes. This page will update by itself.",
  adminTip: "Jellyfin looks up artwork and descriptions on TMDB, through its TMDb plugin, from the folder name (\"Title (year)\"). If the plugin is off, the name isn't recognized or Jellyfin can't reach the Internet, it finds nothing.",
  adminTipJellyfin: "Check Jellyfin's settings",
  adminTipTmdbKey: "Add Tentacle's TMDB key",
  rescanError_busy: "A scan is already being started. Try again in a moment.",
  "rescanError_not-found": "Jellyfin no longer knows this title. Reload the page.",
  "rescanError_not-configured": "Jellyfin isn't linked to Tentacle yet.",
  rescanError_unreachable: "Jellyfin isn't answering. Try again in a moment.",
  rescanError_rejected: "Jellyfin refuses Tentacle's admin key: see the administration.",
  "rescanError_bad-request": "This title can't be scanned.",
  rescanError_failed: "The scan couldn't be started. Try again in a moment.",
  bodyTv: "Artwork and details come from Jellyfin and haven't been found for this title yet. You can already watch it.",
};
