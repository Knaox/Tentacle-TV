/**
 * L'assistant d'installation dans l'app Windows « Tentacle Server » : le
 * Jellyfin de ce PC (détecté, installé avec l'installateur officiel, démarré)
 * et la boîte « Choisir un dossier » de l'Explorateur. Jellyfin y est nommé en
 * texte seulement, jamais avec son logo. Fondu dans `setupWizard`.
 */
export default {
  jfSubtitleWindowsApp: "Tentacle cherche Jellyfin sur ce PC et sur votre réseau.",
  localChecking: "Recherche de Jellyfin sur ce PC…",
  localStoppedTray: "Jellyfin est installé sur ce PC, mais il est arrêté.",
  localStart: "Démarrer Jellyfin",
  localStarting: "Démarrage de Jellyfin…",
  localStartWaiting: "Jellyfin démarre. Tentacle le cherche toutes les quelques secondes.",
  localStoppedService:
    "Jellyfin est installé comme service Windows, et il est arrêté. Ouvrez Services (touche Windows, puis « services »), choisissez « Jellyfin Server », puis « Démarrer ». Tentacle ne démarre jamais un service à votre place.",
  localStoppedUnknown: "Jellyfin semble installé sur ce PC, mais il ne répond pas. Lancez-le, puis relancez la recherche.",
  localStartFailed: "Jellyfin n'a pas pu être démarré. Lancez-le depuis le menu Démarrer, puis relancez la recherche.",

  installTitle: "Installer Jellyfin sur ce PC",
  installIntro:
    "Jellyfin est le serveur multimédia gratuit qui lit vos films ; Tentacle s'appuie sur lui. Tentacle peut télécharger son installateur officiel sur jellyfin.org, vérifier qu'il est intact, puis l'ouvrir.",
  installAdvice:
    "Dans l'installateur, choisissez « Installation simple » (Basic Install) : Jellyfin démarrera avec votre session Windows, sans service.",
  installButton: "Télécharger et installer Jellyfin",
  installOpenSite: "Ouvrir jellyfin.org",
  installRetry: "Réessayer",
  install_resolving: "Recherche de la version à installer…",
  install_downloading: "Téléchargement de Jellyfin {{version}} : {{percent}} %",
  install_downloadingUnknown: "Téléchargement de Jellyfin {{version}}…",
  install_verifying: "Vérification de l'installateur…",
  install_installing:
    "L'installateur de Jellyfin est ouvert. Windows demande d'abord votre accord ; choisissez ensuite « Installation simple », puis suivez ses écrans.",
  install_done: "Jellyfin est installé. Tentacle le cherche…",
  installFailed_unsupported_arch:
    "Jellyfin ne publie pas d'installateur pour ce PC (processeur ARM). Téléchargez-le sur jellyfin.org, puis revenez ici : Tentacle le trouvera.",
  installFailed_disabled:
    "Téléchargez Jellyfin sur jellyfin.org et installez-le (choisissez « Installation simple »), puis revenez ici : Tentacle le trouvera.",
  installFailed_no_version: "Tentacle n'a pas trouvé de version de Jellyfin à installer. Téléchargez-la sur jellyfin.org, puis revenez ici.",
  installFailed_network: "Le téléchargement de Jellyfin a échoué. Vérifiez la connexion à Internet et réessayez, ou téléchargez-le sur jellyfin.org.",
  installFailed_checksum:
    "L'installateur téléchargé ne correspond pas à celui que publie Jellyfin : il a été supprimé, et rien n'a été lancé. Réessayez, ou téléchargez-le sur jellyfin.org.",
  installFailed_cancelled: "L'installation de Jellyfin a été annulée. Vous pouvez la relancer.",
  installFailed_blocked:
    "Windows a bloqué l'installateur de Jellyfin (Smart App Control, ou une règle de ce PC). Téléchargez-le sur jellyfin.org et lancez-le vous-même, puis revenez ici.",
  installFailed_installer_failed: "L'installateur de Jellyfin s'est arrêté sur une erreur. Réessayez, ou téléchargez-le sur jellyfin.org.",

  explorerPick: "Parcourir avec l'Explorateur",
  explorerPicking: "Choisissez le dossier dans la fenêtre de l'Explorateur…",
  explorerTitle: "Dossier de « {{name}} »",
  explorerTitleUnnamed: "Dossier de la bibliothèque",
  explorerMapped: "« {{path}} » est un lecteur réseau : Jellyfin ne le voit pas sous cette lettre. Utilisez son chemin réseau, {{unc}}.",
  explorerUseUnc: "Utiliser {{unc}}",
  explorerNotFound: "Jellyfin ne voit pas « {{path}} ». Vérifiez que ce dossier existe et que Jellyfin peut le lire.",
  libraryBrowseJellyfin: "Parcourir les dossiers de Jellyfin",
};
