export default {
  // Header / panneau
  title: "Watch Together",
  createGroup: "Créer un groupe",
  creating: "Création…",
  yourGroup: "Votre groupe",
  membersCount: "{{count}} membre",
  membersCount_other: "{{count}} membres",
  host: "Hôte",
  you: "Vous",
  invite: "Inviter",
  leaveGroup: "Quitter le groupe",
  kick: "Expulser",
  online: "En ligne",
  offline: "Hors ligne",
  watching: "En lecture",
  bufferingStatus: "Mise en mémoire tampon…",
  cantPlay: "Ne peut pas lire ce média",
  noGroup: "Aucun groupe actif.",
  noGroupHint: "Créez un groupe et invitez d'autres utilisateurs : tout ce que vous regarderez sera parfaitement synchronisé.",

  // Invitations
  invitations: "Invitations",
  invitedBy: "{{name}} vous invite à regarder ensemble",
  invitedByWithItem: "{{name}} vous invite à regarder {{title}}",
  accept: "Accepter",
  decline: "Refuser",
  invitesSent: "Invitation envoyée",
  invitesSent_other: "{{count}} invitations envoyées",
  inviteAccepted: "{{name}} a accepté l'invitation",
  inviteDeclined: "{{name}} a refusé l'invitation",
  selectUsers: "Inviter des utilisateurs",
  searchUsers: "Rechercher un utilisateur…",
  noUsersFound: "Aucun utilisateur trouvé.",
  sendInvites: "Inviter",
  sendInvitesCount: "Inviter ({{count}})",
  cancel: "Annuler",

  // Fiche média
  watchTogetherAction: "Regarder ensemble",
  playInGroup: "Lire dans le groupe",

  // Toasts d'événements
  memberJoined: "{{name}} a rejoint le groupe",
  memberLeft: "{{name}} a quitté le groupe",
  memberKicked: "{{name}} a été expulsé du groupe",
  youWereKicked: "Vous avez été expulsé du groupe",
  hostTransferred: "{{name}} est maintenant l'hôte",
  youAreHost: "Vous êtes maintenant l'hôte du groupe",
  pausedBy: "{{name}} a mis en pause",
  resumedBy: "{{name}} a repris la lecture",
  seekedBy: "{{name}} a changé de position",
  itemStartedBy: "{{name}} a lancé la lecture",
  groupDissolved: "Le groupe a été dissous",
  memberCantPlay: "{{name}} ne peut pas lire ce média",

  // Overlay player
  memberBuffering: "{{name}} met en mémoire tampon…",
  membersBuffering: "{{count}} membres mettent en mémoire tampon…",
  waitingForGroup: "En attente du groupe…",

  // Pilule flottante
  groupPlaybackActive: "Lecture de groupe en cours",
  rejoin: "Rejoindre",

  // Chat de groupe
  chatTitle: "Chat du groupe",
  chatPlaceholder: "Écrire un message…",
  chatSend: "Envoyer",
  chatEmpty: "Aucun message pour l'instant. Dites bonjour !",
  chatOpenAria: "Ouvrir le chat du groupe",
  chatUnreadAria: "Ouvrir le chat du groupe ({{count}} message non lu)",
  chatUnreadAria_other: "Ouvrir le chat du groupe ({{count}} messages non lus)",

  // Erreurs
  alreadyInGroup: "Vous êtes déjà dans un groupe.",
  groupGone: "Ce groupe n'existe plus.",
  inviteExpired: "Cette invitation n'est plus valide.",
  errorGeneric: "Une erreur est survenue.",
} as const;
