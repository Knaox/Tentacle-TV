/**
 * Les profils de la Famille sur l'application de BUREAU — « Qui regarde ? » à
 * l'ouverture, le code PIN, le changement de profil depuis la barre du haut,
 * la session d'un profil et le réglage « Demander qui regarde à l'ouverture ».
 * Les mots communs à tous les clients (rôles, refus du serveur) restent dans
 * `family` ; ceux de la TV dans `familyTv`.
 */
export default {
  whoIsWatching: "Qui regarde ?",
  loading: "Chargement des profils…",
  opening: "Ouverture de {{name}}…",
  manageProfiles: "Gérer les profils",
  you: "Vous",
  guest: "Invité",
  hasPin: "Protégé par un code PIN",
  lockedUntil: "Bloqué jusqu'à {{time}}",
  loadFailed: "Impossible de lire les profils de la famille.",
  retry: "Réessayer",
  tileLabel: "Ouvrir le profil de {{name}}",
  tileLabelPin: "Ouvrir le profil de {{name}}, protégé par un code PIN",
  pin: {
    title: "Code PIN de {{name}}",
    prompt: "Saisissez les quatre chiffres.",
    checking: "Vérification…",
    wrong_one: "Code incorrect — {{count}} essai avant blocage.",
    wrong_other: "Code incorrect — {{count}} essais avant blocage.",
    locked: "Trop d'essais. Réessayez à {{time}}.",
    progress_one: "{{count}} chiffre sur 4",
    progress_other: "{{count}} chiffres sur 4",
    erase: "Effacer",
    digit: "Chiffre {{digit}}",
    keypad: "Pavé numérique",
    back: "Retour aux profils",
    cancel: "Annuler",
  },
  refusal: {
    unavailable: "Ce profil n'est plus disponible.",
    disabled: "L'administrateur du serveur a coupé les profils de la famille.",
    guestsDisabled: "L'administrateur du serveur a coupé les profils invités.",
    offline: "Le serveur ne répond pas. Vérifiez la connexion, puis réessayez.",
    failed: "Ce profil n'a pas pu s'ouvrir. Réessayez.",
  },
  switcher: {
    title: "Changer de profil",
    current: "Profil actuel",
    switching: "Passage au profil de {{name}}…",
    ownProfile: "Revenir à mon profil",
  },
  session: {
    badge: "Profil de {{name}}",
    guestBadge: "Profil invité",
    ended: "La session de ce profil a pris fin.",
    restricted: "Revenez à votre propre profil pour y accéder.",
  },
  launchSetting: {
    title: "Demander qui regarde à l'ouverture",
    caption: "Sur tous vos ordinateurs : l'application s'ouvre sur le choix du profil, chacun derrière son code PIN s'il en a un.",
    on: "Activé sur tous vos ordinateurs",
    off: "Désactivé",
    failed: "Le réglage n'a pas pu être enregistré. Réessayez.",
  },
} as const;
