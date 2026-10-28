/**
 * Octave — la coquille du mode musique : la signature de Tentacle, le retour
 * aux films, le repère de la première fois, le menu du profil et sa feuille de
 * code PIN. Mêmes consignes que `music` : aucune source hors bibliothèque
 * nommée, jamais le mot « téléchargement ».
 */
export default {
  signature: {
    of: "Tentacle",
    label: "Octave, le mode musique de Tentacle",
  },
  backToFilms: {
    label: "Films et séries",
    hint: "Quitter le mode musique et revenir aux films et séries de Tentacle",
  },
  firstVisit: {
    title: "Octave, le mode musique de Tentacle",
    body: "Pour revenir aux films et séries, c'est ici.",
    dismiss: "Compris",
  },
  profile: {
    button: "Profil {{name}}",
    menu: "Profil",
    current: "Profil actuel",
    guest: "Profil invité",
    switch: "Changer de profil",
    manage: "Gérer les profils",
    whoListens: "Qui écoute ?",
    choose: "Choisissez un profil. Vous restez dans Octave.",
    close: "Fermer",
  },
  profiles: {
    title: "Gérer les profils",
    lead: "Les profils de la famille, les mêmes que dans Tentacle : ce que vous changez ici vaut partout.",
  },
  pinSheet: {
    cancel: "Annuler",
  },
  appearance: {
    title: "Octave",
    caption: "Le mode musique a sa propre apparence, sur cet appareil.",
    theme: "Apparence d'Octave",
    themeSame: "Comme Tentacle",
    themeLight: "Clair",
    themeDark: "Sombre",
    glass: "Liquid Glass dans Octave",
    tentacleGlass: "Liquid Glass dans Tentacle",
  },
  crossfade: {
    section: "Lecture",
    caption: "Le passage d'un titre au suivant, sur cet appareil.",
    label: "Transition douce",
    hint: "Un fondu enchaîné entre deux titres, comme à la radio. Jamais à l'intérieur d'un album écouté dans l'ordre, ni quand vous passez vous-même au suivant.",
    duration: "Durée du fondu",
    seconds_one: "{{count}} s",
    seconds_other: "{{count}} s",
    off: "Coupée",
    chipOff: "Fondu coupé",
    chipOn_one: "Fondu {{count}} s",
    chipOn_other: "Fondu {{count}} s",
    controlHint: "Entre deux titres de la file, l'un s'efface pendant que l'autre arrive. Glissez pour choisir la durée.",
    controlOff: "Chaque titre s'enchaîne sans fondu.",
    turnOn: "Activer le fondu",
    turnOff: "Couper le fondu",
    close: "Fermer",
    outgoing: "Titre qui part",
    incoming: "Titre qui arrive",
  },
  launchPin: {
    label: "Ne pas demander le code PIN au démarrage",
    hint: "L'application rouverte dans Octave reprend le profil ouvert, sans « Qui regarde ? » ni code PIN. Changer de profil le demande toujours.",
  },
  /** Le hub « Compte » d'Octave mobile (l'avatar en tête des pages). */
  account: {
    title: "Compte",
    open: "Compte et réglages",
    openHint: "Profil, réglages d'Octave, apparence, hors ligne",
    profileGroup: "Profil",
    photoHint: "Toucher la photo pour la changer",
    pin: "Code PIN",
    pinOn: "Protège votre profil",
    pinOff: "Aucun code",
    manageHint: "Membres, invités, droits",
    octaveGroup: "Octave",
    settingsHint: "Transition, démarrage, langue",
    offline: "Hors ligne",
    offlineHint: "La musique gardée sur cet appareil",
    appearanceGroup: "Apparence",
    leaveGroup: "Tentacle TV",
    leave: "Revenir à Tentacle TV",
    leaveHint: "Films et séries",
  },
  settingsMobile: {
    switchProfileHint: "Le même choix que dans Tentacle, code PIN compris.",
  },
  settings: {
    kicker: "Octave",
    title: "Réglages d'Octave",
    appearance: "Apparence",
    startup: "Démarrage",
    nav: "Réglages",
    shortcut: "Réglages d'Octave…",
    open: "Ouvrir les réglages d'Octave",
    language: "Langue",
    languageLabel: "Langue de l'interface",
    languageCaption: "Octave et Tentacle, sur tous vos appareils.",
    profiles: "Profils",
    profilesCaption: "La famille de votre compte : les mêmes profils que dans Tentacle.",
    shared: "Aussi dans Tentacle",
    sharedLead: "Ces réglages sont ceux de Tentacle : les changer ici les change aussi là-bas.",
  },
  artistMore: {
    elsewhere: "Pas encore dans votre bibliothèque",
    library: "Aussi dans votre bibliothèque",
  },
  track: {
    goToArtistNamed: "Voir {{artist}}",
  },
  /** La coquille mobile et tablette (app native, web étroit). */
  mobile: {
    enter: "Octave",
    enterHint: "Passer au mode musique",
    back: "Retour",
    soon: "Cette page arrive bientôt.",
    unavailable: "Octave n'est pas disponible sur ce serveur.",
    sidebar: "Navigation musique",
  },
};
