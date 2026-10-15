// Les droits d'un compte (fiche de l'administration › Utilisateurs) et le
// vocabulaire du contrôle parental, repris par la Famille. Espace à part, comme
// `adminInvites` : `admin` dépasserait la taille d'un fichier.
export default {
  sectionTitle: "Droits",
  sectionHint: "Lus et écrits dans Jellyfin : ce que vous changez ici s'y voit, et l'inverse.",
  loadError: "Droits illisibles : Jellyfin n'a pas répondu.",
  optionsError: "Bibliothèques et notes illisibles : Jellyfin n'a pas répondu.",
  retry: "Réessayer",
  saved: "Enregistré dans Jellyfin.",
  saving: "Enregistrement…",

  groups: {
    account: "Compte",
    libraries: "Bibliothèques",
    parental: "Contrôle parental",
    playback: "Lecture",
    offline: "Hors ligne",
    management: "Gestion",
  },

  summary: {
    disabled: "Désactivé",
    admin: "Administrateur",
    standard: "Utilisateur",
    localOnly: "Réseau local seulement",
    allLibraries: "Toutes les bibliothèques",
    someLibraries_one: "{{count}} bibliothèque sur {{total}}",
    someLibraries_other: "{{count}} bibliothèques sur {{total}}",
    ratingMax: "Jusqu'à {{rating}}",
    ratingMaxScore: "Note maximale {{score}}",
    unrated_one: "{{count}} type non classé bloqué",
    unrated_other: "{{count}} types non classés bloqués",
    blockedTags_one: "{{count}} étiquette bloquée",
    blockedTags_other: "{{count}} étiquettes bloquées",
    allowedTags_one: "{{count}} étiquette autorisée",
    allowedTags_other: "{{count}} étiquettes autorisées",
    schedules_one: "{{count}} plage d'accès",
    schedules_other: "{{count}} plages d'accès",
    scheduleNever: "Aucune plage permise",
    // L'administrateur qui règle ses PROPRES plages : Tentacle les applique aussi aux administrateurs.
    scheduleSelfNotice: "Ces plages s'appliquent aussi à vous. Hors de ces plages, vous n'aurez plus accès à Tentacle.",
    noParental: "Aucune restriction",
    noPlayback: "Lecture interdite",
    noVideoTranscode: "Sans conversion vidéo",
    forceTranscode: "Conversion forcée à distance",
    bitrate: "{{mbps}} Mbit/s à distance",
    noSyncPlay: "Sans Watch Together",
    syncPlayJoinOnly: "Watch Together : rejoindre seulement",
    playbackFull: "Tout est permis",
    noDownload: "Rien hors ligne",
    download: "Téléchargement",
    downloadAndLight: "Téléchargement et version légère",
    managementCount_one: "{{count}} droit de gestion",
    managementCount_other: "{{count}} droits de gestion",
    managementNone: "Aucun droit de gestion",
  },

  fields: {
    isAdministrator: { label: "Administrateur", hint: "Règle le serveur Tentacle, tous les comptes et Jellyfin tout entier." },
    isDisabled: { label: "Compte désactivé", hint: "Plus aucune connexion, sur aucun appareil, jusqu'à réactivation." },
    enableRemoteAccess: { label: "Accès à distance", hint: "Coupé, le compte ne se connecte que depuis le réseau de la maison." },
    maxActiveSessions: { label: "Sessions simultanées", hint: "Combien d'appareils peuvent être connectés à la fois. 0 : sans limite." },
    loginAttemptsBeforeLockout: { label: "Essais avant blocage", hint: "Mots de passe faux tolérés avant que le compte soit bloqué. 0 : la valeur de Jellyfin (3 essais) ; -1 : jamais bloqué." },
    enableAllFolders: { label: "Toutes les bibliothèques", hint: "Y compris celles qui seront créées plus tard." },
    enabledFolders: { label: "Bibliothèques permises", hint: "Le compte ne voit rien des autres, nulle part dans Tentacle." },
    // Le contrôle parental reprend les mots de l'onglet « Contrôle parental » de Jellyfin 10.11.
    maxParentalRating: { label: "Classification parentale maximale", hint: "Le contenu ayant une classification plus élevée ne sera pas visible par cet utilisateur, nulle part dans Tentacle." },
    blockUnratedItems: { label: "Bloquer les éléments avec des informations de classification inconnues ou n'en disposant pas", hint: "Un élément de ce type sans classification est caché." },
    allowedTags: { label: "Autoriser les objets comportant des étiquettes", hint: "Afficher uniquement les médias comportant au moins l'une des étiquettes spécifiées." },
    blockedTags: { label: "Bloquer les éléments avec les étiquettes", hint: "Masquer les médias contenant au moins l'une des étiquettes spécifiées." },
    accessSchedules: { label: "Programme d'accès", hint: "Créer un programme d'accès pour limiter l'accès à certaines heures. En dehors, Tentacle refuse tout à ce compte, sur tous ses appareils." },
    enableMediaPlayback: { label: "Lecture", hint: "Coupée, le compte parcourt la bibliothèque sans rien pouvoir lire." },
    enableAudioPlaybackTranscoding: { label: "Conversion du son", hint: "Le serveur convertit une piste son que l'appareil ne sait pas lire. Coupée, cette piste ne se lit pas." },
    enableVideoPlaybackTranscoding: { label: "Conversion de la vidéo", hint: "Le serveur convertit l'image qu'un appareil ne sait pas lire, ou la réduit pour un débit limité. C'est ce qui coûte le plus au processeur." },
    enablePlaybackRemuxing: { label: "Changement de conteneur", hint: "Le serveur réemballe le fichier sans le convertir : l'image reste intacte, le serveur à peine sollicité." },
    forceRemoteSourceTranscoding: { label: "Forcer la conversion à distance", hint: "Hors de la maison, le serveur convertit toujours, même un fichier lisible tel quel." },
    remoteClientBitrateLimit: { label: "Débit maximal à distance", hint: "Hors de la maison, en Mbit/s : au-delà, le serveur réduit la qualité. 0 : sans limite." },
    syncPlayAccess: { label: "Watch Together", hint: "Regarder ensemble, au même moment, dans un salon." },
    enableContentDownloading: { label: "Téléchargement", hint: "Garder des films et des épisodes sur ses appareils pour les regarder hors ligne." },
    enableMediaConversion: { label: "Version légère", hint: "Préparer une copie plus petite avant de la télécharger. Demande aussi la conversion de la vidéo ou le changement de conteneur." },
    enableContentDeletion: { label: "Supprimer des titres", hint: "Effacer du disque un film, un épisode ou une série, dans toutes les bibliothèques — un par un ou par sélection." },
    enableContentDeletionFromFolders: { label: "Supprimer dans ces bibliothèques", hint: "Sans le droit de tout supprimer : effacer des titres de ces bibliothèques seulement." },
    enablePublicSharing: { label: "Partage public", hint: "Partager Ma liste, ses favoris et ses statistiques par un lien ouvert à qui l'a. Coupé, ses liens ne montrent plus rien, jusqu'à ce qu'il le retrouve." },
  },

  values: {
    unlimited: "Sans limite",
    noLimit: "Aucune limite",
    syncPlay: { CreateAndJoinGroups: "Créer et rejoindre", JoinGroups: "Rejoindre seulement", None: "Interdit" },
    syncPlayDetail: {
      CreateAndJoinGroups: "Créer un salon, ou rejoindre celui d'un autre.",
      JoinGroups: "Rejoindre le salon d'un autre, sans pouvoir en créer.",
      None: "Watch Together n'apparaît plus pour ce compte.",
    },
  },

  libraries: {
    none: "Aucune bibliothèque sur ce Jellyfin.",
    unknown: "Bibliothèque disparue",
  },

  parental: {
    unknownRating: "Classification {{score}} (absente de la table de Jellyfin)",
    unratedTitle: "Types bloqués sans note",
    unrated: {
      Book: "Livres", ChannelContent: "Chaînes", LiveTvChannel: "TV en direct", Movie: "Films", Music: "Musique",
      Trailer: "Bandes-annonces", Series: "Séries", LiveTvProgram: "Programmes TV", Other: "Autres",
    },
    tagPlaceholder: "Ajouter une étiquette",
    tagAdd: "Ajouter",
    tagRemove: "Retirer l'étiquette {{tag}}",
    tagEmpty: "Aucune étiquette.",
    tagSuggestions: "Étiquettes de la bibliothèque",
    scheduleDay: "Jour de la semaine",
    scheduleFrom: "Heure de début",
    scheduleTo: "Heure de fin",
    scheduleAdd: "Ajouter",
    scheduleRemove: "Retirer la plage {{day}} {{from}} - {{to}}",
    scheduleEmpty: "Aucun programme : accès à toute heure.",
    scheduleInvalid: "L'heure de fin doit suivre l'heure de début.",
    scheduleNever: "Jamais : aucune plage permise, la connexion est toujours refusée.",
    scheduleRange: "{{from}} - {{to}}",
    // Les jours de Jellyfin ; « Jours de la semaine » et « Week-ends » disent entre parenthèses ce qu'ils couvrent.
    days: {
      Sunday: "Dimanche", Monday: "Lundi", Tuesday: "Mardi", Wednesday: "Mercredi", Thursday: "Jeudi", Friday: "Vendredi",
      Saturday: "Samedi", Everyday: "Tous les jours", Weekday: "Jours de la semaine (lun. → ven.)", Weekend: "Week-ends (sam., dim.)",
    },
  },

  number: {
    save: "Enregistrer",
    invalid: "Un nombre entier, s'il vous plaît.",
    range: "Entre {{min}} et {{max}}.",
  },

  self: {
    isAdministrator: "Vous ne pouvez pas vous retirer l'administration.",
    isDisabled: "Vous ne pouvez pas désactiver votre propre compte.",
  },

  confirm: {
    cancel: "Annuler",
    isAdministrator: {
      title: "Faire de {{name}} un administrateur ?",
      message: "Ce compte pourra tout régler : le serveur, les autres comptes et Jellyfin.",
      confirm: "Donner l'administration",
    },
    isDisabled: {
      title: "Désactiver {{name}} ?",
      message: "Ses appareils sont déconnectés et plus aucune connexion n'est possible jusqu'à réactivation.",
      confirm: "Désactiver",
    },
  },

  refusal: {
    unknown_user: "Ce compte n'existe plus dans Jellyfin.",
    family_guest: "C'est un invité de la Famille : il suit les droits de son créateur et se règle depuis la Famille.",
    last_admin: "C'est le dernier administrateur : donnez d'abord l'administration à un autre compte.",
    self_lockout: "Vous ne pouvez pas vous retirer l'administration, désactiver votre propre compte, ni vous exclure par un programme d'accès.",
    self_lockout_schedule: "Ce programme vous exclurait de Tentacle dès maintenant : gardez une plage qui couvre l'heure actuelle.",
    invalid_value: "Jellyfin n'accepte pas cette valeur. L'état réel a été relu.",
    jellyfin_unreachable: "Jellyfin n'a pas répondu : rien n'a changé.",
    jellyfin_refused: "Jellyfin a refusé le changement : rien n'a changé.",
    unknown: "Le changement n'a pas pu être enregistré. L'état réel a été relu.",
  },
};
