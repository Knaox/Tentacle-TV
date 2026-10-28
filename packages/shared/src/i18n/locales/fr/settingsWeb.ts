/**
 * Les RÉGLAGES du web large et du bureau (refonte du 2026-10-26) : rubriques,
 * intertitres du rail, phrases d'intro, groupes, et pour CHAQUE réglage son
 * libellé, la phrase qui dit ce qu'il fait, et les mots qu'on taperait pour
 * le chercher. Structure : `@tentacle-tv/shared` › `settingsCatalog`
 * (`wideSettingsSections.ts`). La pastille de portée vient de `settingsMobile`
 * › `scope`.
 */
export default {
  rail: {
    watch: "Regarder",
    interface: "Interface",
    you: "Vous",
  },
  search: {
    label: "Rechercher dans les réglages",
    placeholder: "Rechercher un réglage",
    clear: "Effacer la recherche",
    title: "Résultats pour « {{query}} »",
    count_one: "{{count}} réglage",
    count_other: "{{count}} réglages",
    empty: "Aucun réglage ne correspond à « {{query}} ».",
    emptyHint: "Essayez un mot plus court ou un autre mot : « sous-titres », « thème », « intro », « mot de passe »…",
    where: "{{section}} › {{group}}",
  },
  detailToggle: "Régler en détail",
  scopeLegend: "« Compte » : enregistré avec votre compte, il vous suit sur tous vos appareils. « Cet appareil » : ne vaut que sur ce navigateur ou cet ordinateur.",
  sections: {
    playback: {
      label: "Lecture",
      intro: "Ce que le lecteur fait tout seul, et la vidéo de cet ordinateur.",
    },
    languages: {
      label: "Langues et sous-titres",
      intro: "Les pistes audio et les sous-titres choisis d'office pour chaque bibliothèque, et la langue des menus. Enregistrés avec votre compte.",
    },
    downloads: {
      label: "Téléchargements",
      intro: "Où sont rangés les titres téléchargés sur cet ordinateur, et comment ils arrivent.",
    },
    appearance: {
      label: "Apparence",
      intro: "L'aspect de l'application. Ces réglages ne valent que sur cet appareil.",
    },
    personalization: {
      label: "Accueil et découverte",
      intro: "Ce que l'accueil montre, comment les cartes réagissent, et ce que les recommandations ont le droit d'utiliser.",
    },
    family: {
      label: "Famille",
      intro: "Les profils de votre famille, votre code PIN, et « Qui regarde ? » à l'ouverture.",
    },
    security: {
      label: "Compte et sécurité",
      intro: "Votre mot de passe, vos appareils jumelés, vos comptes liés, et ce qui ne touche que cet appareil.",
    },
  },
  groups: {
    playback: {
      player: "Sauts et enchaînement",
      stillWatching: "Pause automatique",
      data: "Connexion",
      video: "Vidéo sur cet ordinateur",
    },
    languages: {
      tracks: "Audio et sous-titres par bibliothèque",
      interface: "Langue de l'interface",
    },
    downloads: {
      storage: "Stockage",
      transfers: "Transferts",
    },
    appearance: {
      theme: "Thème",
      effects: "Effets",
      octave: "Octave",
    },
    personalization: {
      startup: "Au démarrage",
      hero: "Bandeau principal",
      rows: "Rangées de l'accueil",
      previews: "Aperçus au survol",
      reco: "Recommandations",
    },
    family: {
      profiles: "Les profils",
      myPin: "Mon code PIN",
      launch: "À l'ouverture",
      leave: "Quitter",
    },
    security: {
      signIn: "Connexion",
      linked: "Comptes liés",
      thisDevice: "Cet appareil",
      danger: "Zone sensible",
    },
  },
  entries: {
    playbackMode: {
      label: "Ce que fait le lecteur",
      description: "Choisissez si le lecteur passe tout seul les génériques, résumés et aperçus, ou s'il vous le propose.",
      keywords: "mode, sauter, passer, automatique, intro, générique, skip",
    },
    skipPassages: {
      label: "Passages, un par un",
      description: "Pour l'intro, le résumé, le générique de fin et l'aperçu : passer seul, proposer un bouton ou ne rien faire, et après combien de temps.",
      keywords: "intro, ouverture, générique, résumé, récap, aperçu, prochain épisode, sauter, passer, délai, décompte",
    },
    upNext: {
      label: "Épisode suivant",
      description: "La fiche « À suivre » pendant le générique, son décompte et l'enchaînement automatique.",
      keywords: "à suivre, enchaîner, lecture automatique, autoplay, décompte, prochain, suivant, binge",
    },
    stillWatching: {
      label: "Demander si vous regardez encore",
      description: "Après un long moment sans toucher à rien, la lecture vous le demande, puis se met en pause si personne ne répond.",
      keywords: "êtes-vous là, encore là, pause, veille, endormi, inactivité",
    },
    dataSaver: {
      label: "Économie de données",
      description: "Allège les images et les envois au serveur sur une connexion lente ou limitée.",
      keywords: "données, data, connexion lente, 4G, partage de connexion, forfait, bande passante, qualité",
    },
    hardwareDecoding: {
      label: "Décodage matériel",
      description: "Qui décode la vidéo : la carte graphique, ou le processeur si l'image se dégrade (blocs, artefacts).",
      keywords: "GPU, carte graphique, pilote, artefacts, blocs, macroblocs, hwdec, processeur, logiciel",
    },
    hdrAuto: {
      label: "Basculer l'écran en HDR",
      description: "Passe l'écran en HDR pendant la lecture d'un film HDR, puis le remet comme avant.",
      keywords: "HDR, Dolby Vision, écran, Windows, couleurs, luminosité",
    },
    linuxSession: {
      label: "Affichage vidéo (Wayland ou X11)",
      description: "Wayland permet le HDR ; X11 permet la lecture en fenêtre. Prend effet au prochain lancement.",
      keywords: "Wayland, X11, XWayland, Linux, HDR, fenêtre, plein écran, KDE, GNOME",
    },
    interfaceLanguage: {
      label: "Langue de l'interface",
      description: "La langue des menus et des boutons de Tentacle.",
      keywords: "langue, français, anglais, english, traduction, menus",
    },
    libraryTracks: {
      label: "Langues de lecture par bibliothèque",
      description: "Pour chaque bibliothèque, la langue audio et les sous-titres choisis d'office au début de la lecture.",
      keywords: "sous-titres, audio, piste, VF, VO, VOSTFR, doublage, langue, anime, forcés, sous titres",
    },
    downloadsLocation: {
      label: "Emplacement",
      description: "Le dossier où les titres téléchargés sont rangés sur cet ordinateur.",
      keywords: "dossier, disque, stockage, chemin, emplacement",
    },
    downloadsSpace: {
      label: "Espace disque",
      description: "La place qu'occupent vos téléchargements, et celle qui reste.",
    },
    downloadsBackground: {
      label: "Continuer en arrière-plan",
      description: "Fermer la fenêtre laisse finir les téléchargements en cours, films et musique ; Tentacle se ferme ensuite.",
      keywords: "arrière-plan, fermer, fenêtre, continuer, téléchargements, musique, Octave, transfert",
    },
    theme: {
      label: "Thème",
      description: "Clair, sombre, ou le même que le système.",
      keywords: "sombre, clair, nuit, dark, light, couleur, mode",
    },
    liquidGlass: {
      label: "Liquid Glass",
      description: "Donne aux barres, aux menus et au lecteur le verre de macOS.",
      keywords: "verre, transparence, macOS, effet, flou",
    },
    octaveAppearance: {
      label: "Apparence d'Octave",
      description: "Le thème et le verre du mode musique, réglés à part de Tentacle.",
      keywords: "musique, Octave, thème, sombre, clair",
    },
    octaveStartup: {
      label: "Au démarrage, ouvrir",
      description: "Ce que l'application ouvre à son lancement : Octave, Tentacle, ou le dernier mode utilisé.",
      keywords: "démarrage, lancement, Octave, musique, ouvrir",
    },
    heroSource: {
      label: "Bandeau principal",
      description: "Ce que montre le grand carrousel en haut de l'accueil.",
      keywords: "carrousel, héros, bannière, accueil, en tête",
    },
    cardDensity: {
      label: "Taille des cartes",
      description: "La taille des affiches dans les rangées de l'accueil.",
      keywords: "affiches, densité, compacte, grande, cartes",
    },
    homeRows: {
      label: "Rangées et leur ordre",
      description: "Les rangées sous le bandeau : les réordonner, ou en masquer sans les supprimer.",
      keywords: "accueil, rangées, ordre, masquer, continuer, derniers ajouts",
    },
    trailerPreviews: {
      label: "Aperçus au survol",
      description: "Laissez le pointeur sur une affiche : sa bande-annonce se lance, avec le son.",
      keywords: "bande-annonce, trailer, survol, vidéo, son, aperçu",
    },
    trailerPreviewDelay: {
      label: "Délai avant l'aperçu",
      description: "Le temps à laisser le pointeur sur une affiche avant que sa bande-annonce paraisse.",
      keywords: "bande-annonce, délai, attente, survol",
    },
    trendingNow: {
      label: "Tendances actuelles",
      description: "En tête de « Pour vous », ce qui se regarde le plus cette semaine, sans tenir compte de vos goûts.",
      keywords: "tendances, populaire, semaine, pour vous",
    },
    recoPersonalized: {
      label: "Recommandations personnalisées",
      description: "Des suggestions construites sur vos notes, favoris et visionnages.",
      keywords: "pour vous, suggestions, goûts, recommandations",
    },
    recoVigie: {
      label: "Inclure les titres hors bibliothèque",
      description: "Propose aussi des titres absents de la bibliothèque, qu'on peut demander.",
      keywords: "demander, absent, catalogue, Vigie, hors bibliothèque",
    },
    recoCommunity: {
      label: "Recommandations communautaires",
      description: "La rangée « Les utilisateurs de Tentacle regardent aussi ».",
      keywords: "communauté, autres utilisateurs, regardent aussi",
    },
    recoShareHistory: {
      label: "Partager mon historique avec la communauté",
      description: "Votre visionnage entre, anonymement, dans les recommandations communautaires.",
      keywords: "vie privée, confidentialité, historique, anonyme, partage",
    },
    recoBalance: {
      label: "Équilibre des suggestions",
      description: "Vers « Sûr », des titres proches de vos goûts ; vers « Aventureux », plus de découvertes.",
      keywords: "découverte, aventureux, sûr, curseur, exploration",
    },
    recoReset: {
      label: "Réinitialiser mon profil de goût",
      description: "Efface le profil calculé et le reconstruit depuis vos notes et votre historique.",
      keywords: "remettre à zéro, effacer, goûts, recommencer",
    },
    familyProfiles: {
      label: "Profils de la famille",
      description: "Les membres et les invités de votre famille, leurs droits et leurs invitations.",
      keywords: "famille, membres, invités, enfants, contrôle parental, droits, inviter, profils",
    },
    familyPin: {
      label: "Mon code PIN",
      description: "Le code qui protège votre profil quand un appareil partagé demande « Qui regarde ? ».",
      keywords: "PIN, code, verrou, protéger, profil",
    },
    askAtLaunch: {
      label: "Demander « Qui regarde ? » à l'ouverture",
      description: "À chaque ouverture, choisir le profil qui regarde sur cet appareil.",
      keywords: "qui regarde, profil, démarrage, choisir, ouverture",
    },
    familyLeave: {
      label: "Quitter ou dissoudre la famille",
      description: "Partir de la famille (membre), ou la dissoudre (propriétaire).",
      keywords: "quitter, dissoudre, supprimer la famille",
    },
    password: {
      label: "Mot de passe",
      description: "Changer le mot de passe de votre compte, sur tous vos appareils.",
      keywords: "mot de passe, password, sécurité, connexion",
    },
    pairedDevices: {
      label: "Appareils jumelés",
      description: "Les téléviseurs et appareils connectés à votre compte par un code ; retirez ceux que vous n'utilisez plus.",
      keywords: "TV, télé, Apple TV, Android TV, jumelage, appairage, code, révoquer, appareils",
    },
    linkedAccounts: {
      label: "TMDB et vos notes",
      description: "Où partent vos notes, anonymement, et leur synchronisation.",
      keywords: "TMDB, notes, comptes liés, synchronisation, noter",
    },
    changeServer: {
      label: "Changer de serveur",
      description: "Se connecter à un autre serveur Tentacle depuis cette application.",
      keywords: "serveur, adresse, URL, déconnecter, autre serveur",
    },
    clearCache: {
      label: "Vider le cache",
      description: "Remet les réglages de cet appareil à leurs valeurs par défaut et efface son cache, sans vous déconnecter.",
      keywords: "cache, réinitialiser, bug, problème, effacer, mémoire",
    },
    deleteAccount: {
      label: "Supprimer mon compte",
      description: "Supprime définitivement votre compte et ce qui lui appartient sur ce serveur.",
      keywords: "supprimer, effacer, compte, RGPD, fermer",
    },
  },
};
