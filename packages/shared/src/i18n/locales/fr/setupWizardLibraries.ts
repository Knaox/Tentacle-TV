/**
 * L'assistant d'installation : l'écran des bibliothèques — un Jellyfin neuf,
 * ou déjà configuré mais sans aucune bibliothèque (en créer y est
 * facultatif). Les dossiers sont ceux de la machine de JELLYFIN : Linux, un
 * conteneur (`/media`) ou Windows (lecteurs). Fondu dans `setupWizard`.
 */
export default {
  librariesTitleEmpty: "Ce Jellyfin n'a encore aucune bibliothèque",
  librariesSubtitleEmpty: "Une bibliothèque, c'est un dossier où Jellyfin cherche vos films ou vos séries. Créez-en maintenant, ou plus tard depuis Jellyfin\u00a0: c'est facultatif.",
  librariesSkip: "Passer — ne rien créer",
  librariesPick: "Choisissez le dossier de vos films et celui de vos séries.",
  libraryChooseFolder: "Choisir le dossier",
  libraryFolderMissing: "Choisissez un dossier pour «\u00a0{{name}}\u00a0», ou retirez cette bibliothèque.",
  libraryFolderMissingUnnamed: "Choisissez un dossier pour chaque bibliothèque, ou retirez-la.",

  mediaMapTitle: "Où mettre vos fichiers",
  mediaMapInside: "Dans Jellyfin",
  mediaMapHost: "Sur votre serveur",
  mediaMapDocker: "Jellyfin tourne dans un conteneur\u00a0: le dossier {{inside}} qu'il voit est, sur votre serveur, le dossier {{host}}.",
  mediaMapDockerUnknown: "Jellyfin tourne dans un conteneur\u00a0: le dossier {{inside}} qu'il voit est le dossier MEDIA_PATH de votre fichier compose, sur votre serveur.",
  mediaMapHostUnknown: "MEDIA_PATH (fichier compose)",
  pathHint_posix: "Ce sont les dossiers de la machine de Jellyfin (Linux, NAS ou conteneur). Exemples\u00a0: /mnt/films, /srv/media/series.",
  pathHint_windows: "Ce sont les lecteurs et les dossiers du PC de Jellyfin (Windows). Exemples\u00a0: D:\\Films, E:\\Séries.",
  pathHintContainer: "Si Jellyfin tourne dans un conteneur, seuls les dossiers montés dans ce conteneur sont visibles.",
  browserRoot_posix: "/ (racine)",
  browserRoot_windows: "Ce PC — les lecteurs",
  browserDrive: "Lecteur {{name}}",
  recapLibrariesCreate: "À créer dans Jellyfin\u00a0: {{names}}",
  recapLibrariesSkipped: "Aucune — vous pourrez en créer depuis Jellyfin",
  applyLibrariesAndAdvice: "Les bibliothèques, puis les réglages cochés",
};
