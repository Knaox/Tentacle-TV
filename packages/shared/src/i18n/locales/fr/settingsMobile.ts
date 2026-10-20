/**
 * Les RÉGLAGES du mobile et de la tablette (structure de 2026-10-20) : les
 * rubriques, la pastille de portée « Compte » / « Cet appareil », les
 * sections « Sur tous vos appareils » / « Sur cet appareil » et la ligne
 * « Réglages avancés : sur l'app bureau ». Les libellés déjà posés ailleurs
 * (`profile`, `preferences`, `offline`) y restent : on ne renomme jamais une
 * clé existante.
 *
 * ⚠️ Mobile : jamais « téléchargement » ni « télécharger » ici (rejet Apple) —
 * le test du vocabulaire le vérifie.
 */
export default {
  scope: {
    account: "Compte",
    device: "Cet appareil",
    accountA11y: "Réglage du compte : il vous suit sur tous vos appareils",
    deviceA11y: "Réglage de cet appareil : il ne vaut qu'ici",
    intro: "Les réglages marqués « Compte » vous suivent sur tous vos appareils ; ceux marqués « Cet appareil » ne valent qu'ici.",
  },
  sections: {
    account: "Compte",
    accountSummary: "Photo, mot de passe, serveur",
    accountSummaryFamily: "Photo, mot de passe, Famille",
    playback: "Lecture et apparence",
    tv: "TV et appareils",
    tvSummary: "Jumeler une TV, appareils connectés",
    offline: "Hors ligne",
    offlineSummary: "Titres gardés sur cet appareil",
    notifications: "Notifications",
    notificationsSummary: "Nouveautés, demandes, rappels",
    help: "Aide et à propos",
    helpSummary: "Support, version, confidentialité",
    helpSummaryOffline: "Version, confidentialité",
  },
  account: {
    photo: "Photo de profil",
    photoHint: "Visible sur la TV, le bureau et tout client Jellyfin",
    name: "Nom d'utilisateur",
    familyGroup: "Famille",
    familyInvitesBadge_one: "{{count}} invitation",
    familyInvitesBadge_other: "{{count}} invitations",
    switchProfile: "Changer de profil",
    serverGroup: "Serveur",
  },
  playback: {
    everywhere: "Sur tous vos appareils",
    everywhereCaption: "Enregistrés dans votre compte : le bureau, la TV et cet appareil les partagent.",
    thisDevice: "Sur cet appareil",
    thisDeviceCaption: "Propres à cet appareil : son écran, sa puce et son réseau.",
    intros: "Intros et résumés",
    introsHint: "Au début d'un épisode",
    introsButton: "Proposer",
    introsAuto: "Passer",
    introsOff: "Laisser",
    introsButtonHint: "Un bouton « Passer » paraît pendant l'intro.",
    introsAutoHint: "L'intro est passée toute seule, après un court décompte.",
    introsOffHint: "Rien ne s'affiche : l'intro se regarde.",
    nextAutoPlay: "Épisode suivant automatique",
    nextAutoPlayHint: "À la fin d'un épisode, le suivant se lance après le décompte.",
    mediaLanguages: "Langues audio et sous-titres",
    mediaLanguagesHint: "Par bibliothèque",
    interfaceLanguage: "Langue de l'interface",
    trendingNow: "Tendances actuelles dans « Pour vous »",
    trendingNowHint: "Les tendances de la semaine en tête de « Pour vous », sur l'ordinateur et la TV.",
    dataSaver: "Économie de données",
    engine: "Lecteur vidéo",
    engineOptions: "Options du lecteur",
    engineOptionsHint: "Pour les cas particuliers : laissez-les tels quels si tout se lit bien.",
    subtitleSize: "Taille des sous-titres",
    subtitlePosition: "Position des sous-titres",
    engineAuto: "Auto",
    engineSystem: "Système",
    engineAdvanced: "Avancé",
    subtitleSizeHint: "Lecteur avancé ; 160 % par défaut",
    subtitlePositionHint: "100 % = tout en bas de l'image",
  },
  offline: {
    liveTransfers: "Suivi en direct",
    liveTransfersHint: "Temps restant sur l'écran verrouillé pendant un transfert",
    liveTransfersDenied: "Notifications désactivées dans les réglages de l'appareil : le suivi reste invisible.",
  },
  advanced: {
    row: "Réglages avancés : sur l'app bureau",
    rowHint: "Délais, génériques, épisode suivant en détail…",
    title: "Réglages avancés",
    body: "Les réglages fins de la lecture se font sur l'application de bureau (ou le site web) : délais avant chaque saut, génériques de fin des épisodes et des films, aperçus, fiche « à suivre » et affiche de fin, moment où l'épisode suivant est proposé, règles par bibliothèque. Ils sont enregistrés dans votre compte : cet appareil les applique aussitôt.",
    intro: "Ces réglages se font sur l'application de bureau (ou le site web). Ils sont enregistrés dans votre compte : cet appareil les applique aussitôt.",
    items: {
      skipDelays: "Délai avant chaque saut",
      skipCountdown: "Décompte visible avant un saut",
      episodeCredits: "Génériques de fin des épisodes",
      filmCredits: "Génériques de fin des films",
      previews: "Aperçus en fin d'épisode",
      nextCard: "Fiche « À suivre »",
      finalPoster: "Affiche de fin",
      nextTrigger: "Moment où l'épisode suivant est proposé",
      libraryRules: "Règles par bibliothèque",
      nextCountdown: "Durée du décompte de l'épisode suivant",
    },
  },
};
