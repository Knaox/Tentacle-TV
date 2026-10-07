/**
 * The setup wizard: the libraries screen — a new Jellyfin, or one already
 * set up but without any library (creating some is optional there). The
 * folders are those of JELLYFIN's machine: Linux, a container (`/media`) or
 * Windows (drives). Merged into `setupWizard`.
 */
export default {
  librariesTitleEmpty: "This Jellyfin has no library yet",
  librariesSubtitleEmpty: "A library is a folder where Jellyfin looks for your movies or your shows. Create some now, or later from Jellyfin: it's optional.",
  librariesSkip: "Skip — create nothing",
  librariesPick: "Choose the folder of your movies and the folder of your shows.",
  libraryChooseFolder: "Choose the folder",
  libraryFolderMissing: "Choose a folder for “{{name}}”, or remove this library.",
  libraryFolderMissingUnnamed: "Choose a folder for each library, or remove it.",

  mediaMapTitle: "Where to put your files",
  mediaMapInside: "In Jellyfin",
  mediaMapHost: "On your server",
  mediaMapDocker: "Jellyfin runs in a container: the {{inside}} folder it sees is, on your server, the {{host}} folder.",
  mediaMapDockerUnknown: "Jellyfin runs in a container: the {{inside}} folder it sees is the MEDIA_PATH folder of your compose file, on your server.",
  mediaMapHostUnknown: "MEDIA_PATH (compose file)",
  pathHint_posix: "These are the folders of Jellyfin's machine (Linux, NAS or container). Examples: /mnt/movies, /srv/media/shows.",
  pathHint_windows: "These are the drives and folders of Jellyfin's PC (Windows). Examples: D:\\Movies, E:\\Shows.",
  pathHintContainer: "If Jellyfin runs in a container, only the folders mounted into that container are visible.",
  browserRoot_posix: "/ (root)",
  browserRoot_windows: "This PC — drives",
  browserDrive: "Drive {{name}}",
  recapLibrariesCreate: "To create in Jellyfin: {{names}}",
  recapLibrariesSkipped: "None — you can create some from Jellyfin",
  applyLibrariesAndAdvice: "The libraries, then the ticked settings",
};
