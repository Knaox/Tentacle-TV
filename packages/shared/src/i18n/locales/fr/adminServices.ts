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
  optional: "facultatif",

  // Le résumé en tête de page.
  summaryLabel: "État des services",
  goToSection: "{{name}} : {{state}}. Aller à la section.",
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
  publicUrlSet: "Définie",
  publicUrlMissing: "Non définie",
  publicUrlPairingBlocked: "Jumelage TV bloqué",
  directOn: "Activée",
  directOff: "Désactivée",
  audioOn: "Active",
  audioOff: "Désactivée",
  audioNoTool: "Indisponible",

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

  // Base de données.
  databaseTitle: "Base de données",
  databaseDescription:
    "La base MariaDB où le serveur garde sa configuration, les appareils jumelés, les tickets et les préférences.",
  databaseHost: "Hôte",
  databasePort: "Port",
  databaseName: "Base",
  databaseUser: "Utilisateur",
  databasePassword: "Mot de passe",
  databaseVersion: "Version",
  databaseSourceEnv:
    "Fixée par la variable d'environnement DATABASE_URL — docker-compose ou service système. C'est là qu'elle se modifie, avant de redémarrer le serveur : changée ici, elle serait écrasée au démarrage suivant.",
  databaseSourceFile: "Enregistrée par le serveur, dans data/database.json.",
  databasePending:
    "Une autre connexion est enregistrée : elle prendra effet au prochain redémarrage du serveur. Celle-ci reste en service d'ici là.",
  databaseEdit: "Modifier la connexion",
  databaseEditSummary: "Pour déplacer la base vers un autre serveur MariaDB.",
  databaseRestartNote:
    "La nouvelle connexion prend effet au prochain redémarrage du serveur. Rien n'est copié d'une base à l'autre : la nouvelle doit déjà contenir les données.",
  databasePasswordHint: "Redemandé à chaque modification : il ne quitte jamais le serveur.",
  databasePortInvalid: "Un port entre 1 et 65535.",
  databaseSaved: "Connexion enregistrée — redémarrez le serveur pour l'appliquer.",

  // Adresse publique.
  publicUrlTitle: "Adresse publique",
  publicUrlDescription:
    "L'adresse par laquelle les appareils joignent ce serveur depuis Internet — le domaine derrière Cloudflare, par exemple. Les téléviseurs la reçoivent au jumelage : sans elle, le jumelage TV est bloqué.",
  publicUrlLabel: "URL publique du serveur Tentacle TV",
  publicUrlHint: "Par exemple https://tentacle.example.com.",
  publicUrlHintEnv: "Laisser vide pour utiliser la variable d'environnement TENTACLE_PUBLIC_URL ({{url}}).",
  publicUrlInEffect: "En service : {{url}}",
  publicUrlFromEnv: "variable d'environnement",
  publicUrlNone: "Aucune adresse publique : les téléviseurs ne peuvent pas être jumelés.",
  publicUrlClear: "Effacer",
  publicUrlSaved: "Adresse publique enregistrée.",
  publicUrlCleared: "Adresse effacée.",

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
    "Les greffons Jellyfin restent la source première des passages : ils voient la vidéo et l'audio, là où l'analyse embarquée de Tentacle ne lit que les vignettes. En installer un enrichit tous les appareils d'un coup.",
  segmentsPlugins: "Greffons Jellyfin",
  segmentsOpenPlugin: "{{name}} (s'ouvre dans un nouvel onglet)",
  plugin_introSkipper: "Détection par empreinte audio — générique de début et de fin.",
  plugin_chapterSegments: "Convertit les chapitres nommés en passages, sans analyse.",
  plugin_introDb: "Base communautaire de repères, sans analyse locale.",
  plugin_skipmeDb: "Base partagée de repères, en complément d'Intro Skipper.",
  segmentsScanHelp:
    "Ils s'empilent : chacun signale ce qu'il sait, le plus précis l'emporte, et en installer deux ne crée pas de conflit. Après installation, lancez la tâche planifiée « Media segment scan » de Jellyfin — les passages n'apparaissent qu'une fois la bibliothèque analysée.",
  segmentsFrameNote:
    "Quand aucune source ne dit rien de crédible sur le générique de fin, Tentacle analyse lui-même les vignettes de la barre de progression (générique, scène post-générique) — à condition que la tâche « Générer des images Trickplay » de Jellyfin soit passée sur le média.",
  audioTitle: "Analyse audio des épisodes",
  audioNote:
    "Pour un épisode que personne n'a décrit, Tentacle écoute le début et la fin de l'épisode et de ses voisins de saison : ce qui se répète est l'opening ou l'ending. Une fois par épisode, à la première lecture ; deux courts extraits audio transcodés par Jellyfin, jamais pendant qu'un autre spectateur transcode une vidéo ; rien n'est posé en cas de doute.",
  audioTool: "Outil d'empreinte sur ce serveur : {{tool}}.",
  audioUnavailable:
    "Aucun outil d'empreinte sur ce serveur (fpcalc, ou ffmpeg avec chromaprint) : l'analyse audio est inactive. L'image Docker officielle l'embarque.",
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
    "Toute la configuration sera effacée et l'assistant d'installation relancé. Rien ne permettra de revenir en arrière.",
  resetConfirmPrompt: "Pour confirmer, tapez « {{word}} » :",
  resetConfirmWord: "réinitialiser",
  resetConfirm: "Réinitialiser définitivement",
  resetting: "Réinitialisation…",
  resetFailed: "La réinitialisation a échoué : {{message}}",
} as const;
