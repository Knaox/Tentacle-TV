/**
 * La page admin « Services » : connexions du serveur (Jellyfin, base,
 * adresse publique, lecture directe), détection des passages, zone de danger.
 *
 * Un espace de noms à part, comme `adminPlugins` : la page porte plus de
 * textes que tout le reste de l'administration, et `admin` est partagé par
 * toutes ses autres pages.
 */
export default {
  title: "Services",
  description:
    "Les connexions du serveur Tentacle TV et ses réglages : Jellyfin, base de données, adresse publique, lecture directe et détection des passages.",
  recheck: "Revérifier",
  checking: "Vérification…",
  save: "Enregistrer",
  saving: "Enregistrement…",
  cancel: "Annuler",
  test: "Tester",
  testing: "Test en cours…",
  unsaved: "Non enregistré",
  loadError: "Impossible de lire cette section.",
  retry: "Réessayer",

  // Le résumé en tête de page.
  summaryLabel: "État des services",
  summaryUnknown: "Indisponible",
  jellyfinConnected: "Connecté",
  jellyfinUnreachable: "Injoignable",
  jellyfinRejected: "Clé refusée",
  jellyfinNotJellyfin: "Adresse erronée",
  jellyfinNotConfigured: "Non configuré",
  jellyfinKeyToReview: "Clé à revoir",
  databaseConnected: "Connectée",
  databaseDown: "Ne répond pas",
  databaseNotConfigured: "Non configurée",
  databaseRestart: "Redémarrage requis",
  databaseWontOpen: "Ne s'ouvre pas",
  databaseOnNetwork: "Partage réseau",
  publicUrlSet: "Définie",
  publicUrlMissing: "Non définie",
  // Clé gardée (i18n) : le jumelage n'est plus bloqué, il reste à la maison.
  publicUrlPairingBlocked: "Jumelage TV : réseau local seulement",
  directOn: "Activée",
  directOff: "Désactivée",
  audioOn: "Active",
  audioOff: "Désactivée",
  audioNoTool: "Indisponible",
  summaryAudio: "Analyse audio",

  // Jellyfin.
  jellyfinTitle: "Jellyfin",
  jellyfinDescription:
    "Le serveur multimédia que Tentacle habille. Sa clé d'administration porte le travail sans personne derrière : notifications d'ajouts, invitations, création de comptes, écrans d'administration.",
  jellyfinServer: "{{name}} · Jellyfin {{version}}",
  jellyfinVersionOnly: "Jellyfin {{version}}",
  jellyfinUrlLabel: "Adresse du serveur Jellyfin",
  jellyfinUrlHint:
    "Telle que le serveur Tentacle la joint : http://localhost:8096, ou http://jellyfin:8096 entre conteneurs Docker.",
  jellyfinKeyLabel: "Clé API d'administration",
  jellyfinKeyHint: "Créée dans Jellyfin › Tableau de bord › Clés API. Elle ne quitte jamais le serveur Tentacle.",
  jellyfinKeyKeep: "Clé enregistrée — laisser vide pour la garder",
  jellyfinKeyPaste: "Coller la clé API",
  keyHealthOk: "Clé d'administration reconnue",
  keyHealthRevoked: "Clé révoquée ou remplacée dans Jellyfin",
  keyHealthNoRights: "Clé sans droits d'administration",
  keyHealthMissing: "Aucune clé enregistrée",
  jellyfinTestOk: "{{name}} répond — Jellyfin {{version}}",
  jellyfinSaved: "Jellyfin enregistré.",
  errorKeyMissing: "Saisissez la clé API : aucune n'est enregistrée.",
  errorUnreachable: "Jellyfin ne répond pas à cette adresse.",
  errorNotJellyfin: "Cette adresse ne répond pas comme un serveur Jellyfin.",
  errorRejected: "Jellyfin refuse la clé (HTTP {{status}}).",
  errorInvalid: "Une valeur est invalide.",
  errorGeneric: "L'opération a échoué.",
  urlInvalid: "Adresse invalide : elle commence par http:// ou https://.",

  // Base de données : un fichier SQLite, rien à régler (serveur 1.25 et après).
  databaseTitle: "Base de données",
  databaseDescription:
    "Le fichier où le serveur garde sa configuration, les appareils jumelés, les tickets et les préférences. Rien à régler : il vit dans le dossier de données du serveur.",
  databaseEngine: "Moteur",
  databaseVersion: "Version",
  databaseSize: "Taille",
  databasePath: "Fichier",
  databaseErrorTitle: "Le serveur n'arrive pas à ouvrir la base",
  databaseErrorLogs: "Les journaux du serveur disent pourquoi.",
  databaseNetworkTitle: "La base est sur un partage réseau",
  databaseNetwork:
    "Le dossier de données de Tentacle est sur un partage réseau (NFS, SMB…), où SQLite peut se corrompre. Placez-le sur un disque local de la machine qui fait tourner le serveur.",
  // Un serveur d'avant 1.25, sur MariaDB : sa connexion, montrée sans formulaire.
  databaseDescriptionMariaDb:
    "La base MariaDB où le serveur garde sa configuration, les appareils jumelés, les tickets et les préférences.",
  databaseHost: "Hôte",
  databasePort: "Port",
  databaseName: "Base",
  databaseUser: "Utilisateur",
  databasePending:
    "Une autre connexion est enregistrée : elle prendra effet au prochain redémarrage du serveur. Celle-ci reste en service d'ici là.",

  // Adresse publique.
  publicUrlTitle: "Adresse publique",
  publicUrlDescription:
    "L'adresse par laquelle les appareils joignent ce serveur depuis Internet — le domaine derrière Cloudflare, par exemple. Les téléviseurs la reçoivent au jumelage : sans elle, ils reçoivent l'adresse du serveur sur le réseau local, et ne le joignent que de la maison.",
  publicUrlLabel: "URL publique du serveur Tentacle TV",
  publicUrlHint: "Par exemple https://tentacle.example.com.",
  publicUrlHintEnv: "Laisser vide pour utiliser la variable d'environnement TENTACLE_PUBLIC_URL ({{url}}).",
  publicUrlInEffect: "En service : {{url}}",
  publicUrlFromEnv: "variable d'environnement",
  publicUrlNone: "Aucune adresse publique : les téléviseurs se jumellent sur le réseau local seulement.",
  publicUrlSaved: "Adresse publique enregistrée.",
  publicUrlCleared: "Adresse effacée.",

  // Adresses déplacées dans « Accès à distance » (serveur 1.24.0 et après).
  movedTitle: "Adresses et lecture directe",
  movedBody: "Le lien public, les adresses de Jellyfin et la lecture directe se règlent désormais dans Accès à distance, avec ce qui en découle.",
  movedLink: "Ouvrir Accès à distance",

  // Lecture directe.
  directTitle: "Lecture directe",
  directDescription:
    "Les applications lisent vidéos et images chez Jellyfin sans passer par le serveur Tentacle. Chaque appareil reçoit l'adresse qui lui convient : la privée sur le réseau local, la publique ailleurs.",
  directEnable: "Activer la lecture directe",
  directEnableHint: "Désactivée, tout transite par le serveur Tentacle : plus simple, mais plus lourd pour lui.",
  directPublicLabel: "URL publique de Jellyfin",
  directPublicHint: "Joignable depuis Internet, par exemple https://jf.example.com.",
  directPrivateLabel: "URL privée de Jellyfin (réseau local)",
  directPrivateHint: "Joignable depuis le réseau local, par exemple http://192.168.1.50:8096.",
  directUrlsRequired: "Les deux adresses sont nécessaires pour activer la lecture directe.",
  directPrivateRequired: "L'adresse privée est nécessaire pour activer la lecture directe.",
  directPublicSwitch: "Lecture directe depuis l'extérieur (facultatif)",
  directPublicSwitchHint: "Coupée : hors de la maison, la lecture passe par Tentacle. Allumée : Jellyfin doit être joignable depuis Internet.",
  directPublicMissing: "Donnez l'adresse publique de Jellyfin, ou coupez la lecture directe depuis l'extérieur.",
  directMixedContent:
    "Adresse en HTTP sur un site en HTTPS : le navigateur bloquera les flux (contenu mixte). Passez par une adresse HTTPS ou un proxy HTTPS devant Jellyfin.",
  directCorsHelp:
    "Dans un navigateur, Jellyfin doit autoriser l'origine de Tentacle. À l'enregistrement, le serveur l'ajoute lui-même aux hôtes CORS de Jellyfin ; sinon, c'est dans Jellyfin › Tableau de bord › Réseau › Hôtes CORS.",
  directTestPublic: "Adresse publique",
  directTestPrivate: "Adresse privée",
  directTestOk: "Jellyfin {{version}}",
  directCorsOk: "CORS autorisé",
  directCorsMissing: "CORS absent",
  directCorsWarning:
    "Jellyfin n'autorise pas l'origine de Tentacle : la lecture directe échouera dans les navigateurs (pas dans les applications). Ajoutez l'adresse de Tentacle dans Jellyfin › Tableau de bord › Réseau › Hôtes CORS.",
  directTestNone: "Aucune adresse à tester.",
  directSaved: "Lecture directe enregistrée.",

  // Détection des passages.
  segmentsTitle: "Détection des passages",
  segmentsDescription:
    "Les greffons Jellyfin restent la source première des passages : en installer un enrichit tous les appareils d'un coup. L'analyse embarquée de Tentacle vient après eux — elle comble ce qu'ils ne disent pas, et corrige un générique de fin qui avale une scène.",
  segmentsPlugins: "Greffons Jellyfin",
  opensNewTab: "(s'ouvre dans un nouvel onglet)",
  plugin_introSkipper: "Détection par empreinte audio — générique de début et de fin.",
  plugin_chapterSegments: "Convertit les chapitres nommés en passages, sans analyse.",
  plugin_introDb: "Base communautaire de repères, sans analyse locale.",
  plugin_skipmeDb: "Base partagée de repères, en complément d'Intro Skipper.",
  segmentsLearnMore: "Comment ça marche",
  segmentsScanHelp:
    "Ils s'empilent : chacun signale ce qu'il sait, le plus précis l'emporte. « Installer / réparer » ajoute leurs dépôts, les installe, redémarre Jellyfin s'il le faut (jamais pendant qu'on regarde, sauf si vous le demandez) et les règle. Un dépôt hors ligne n'empêche rien : le geste se refait plus tard.",
  // Serveur sans « Installer / réparer » (d'avant 1.24.0) : la phrase sans le geste.
  segmentsStackHelp: "Ils s'empilent : chacun signale ce qu'il sait, le plus précis l'emporte.",
  segmentsFrameNote:
    "À la première lecture de chaque film et de chaque épisode, Tentacle lit sa fin : les vignettes de la barre de progression montrent où défile le générique, l'audio sépare la musique des dialogues. Il en tire le début du générique et les scènes qui le suivent, mi-génériques comme post-génériques — même quand un greffon en avait déjà posé un. Il faut que la tâche « Générer des images Trickplay » de Jellyfin soit passée sur le média ; seul ce qui est trouvé est enregistré.",
  audioTitle: "Analyse audio",
  audioNote:
    "Coupée par défaut. Allumée, Tentacle écoute la fin de chaque film et de chaque épisode pour y distinguer les scènes du générique ; et pour un épisode sans passages connus, le début et la fin de ses voisins de saison : ce qui se répète est l'opening ou l'ending. Une fois par média, à la première lecture ; des extraits audio transcodés par Jellyfin, un à la fois, jamais pendant qu'un autre spectateur transcode une vidéo. Rien n'est enregistré quand l'analyse ne trouve rien.",
  audioTool: "Outil d'empreinte sur ce serveur : {{tool}}.",
  audioUnavailable:
    "Aucun outil d'empreinte sur ce serveur (fpcalc, ou ffmpeg avec chromaprint) : la comparaison des épisodes voisins est inactive. L'image Docker officielle l'embarque.",
  audioSince: "Depuis le démarrage du serveur",
  audioJobs: "Analyses",
  audioWindows: "Extraits transcodés",
  audioData: "Données lues",
  audioTime: "Temps de transcodage",
  audioVerdicts: "Passages trouvés",
  audioSilent: "Sans verdict",
  audioDeferred: "Reportées (serveur occupé)",
  audioEnabled: "Analyse audio activée.",
  audioDisabled: "Analyse audio désactivée.",

  // Zone de danger.
  dangerTitle: "Zone de danger",
  dangerDescription: "Ce qui s'y fait ne se défait pas.",
  resetTitle: "Réinitialiser le serveur",
  resetDescription:
    "Efface toute la configuration du serveur — connexion à Jellyfin, clés, adresse publique, réglages — et relance l'assistant d'installation. Les appareils jumelés, téléviseurs comme téléphones, perdront leur accès et devront être jumelés à nouveau.",
  resetAction: "Réinitialiser…",
  resetConfirmTitle: "Réinitialiser le serveur ?",
  resetConfirmBody:
    "La connexion à Jellyfin, les clés, l'adresse publique et tous les réglages seront effacés, et l'assistant d'installation relancé. Les appareils jumelés devront l'être à nouveau. Rien ne permettra de revenir en arrière.",
  resetConfirmPrompt: "Pour confirmer, tapez « {{word}} » :",
  resetConfirmWord: "réinitialiser",
  resetConfirm: "Réinitialiser définitivement",
  resetting: "Réinitialisation…",
  resetFailed: "La réinitialisation a échoué : {{message}}",
} as const;
