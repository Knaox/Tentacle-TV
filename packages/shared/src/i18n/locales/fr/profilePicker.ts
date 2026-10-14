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
  opening: "Ouverture du profil {{name}}…",
  manageProfiles: "Gérer les profils",
  stayOnDevice: "Ne plus proposer sur cet appareil",
  stayOnDeviceHint: "Cet ordinateur ouvrira directement le profil choisi. Pour en changer : changez de profil depuis le menu de votre avatar.",
  hasPin: "Protégé par un code PIN",
  lockedUntil: "Bloqué jusqu'à {{time}}",
  loadFailed: "Impossible de lire les profils de la famille.",
  retry: "Réessayer",
  tileLabel: "Ouvrir le profil {{name}}",
  tileLabelPin: "Ouvrir le profil {{name}}, protégé par un code PIN",
  pin: {
    title: "Code PIN du profil {{name}}",
    prompt: "Saisissez le code PIN de ce profil.",
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
    switching: "Changement de profil…",
    cancel: "Annuler",
  },
  session: {
    guestBadge: "Profil invité",
    memberBadge: "Profil de la famille",
    ended: "La session de ce profil a pris fin.",
    offlineMessage: "La bibliothèque de ce profil reviendra d'elle-même dès que la connexion sera rétablie.",
  },
  launchSetting: {
    section: "Sur vos ordinateurs",
    title: "Demander qui regarde à l'ouverture",
    caption: "L'application s'ouvre sur « Qui regarde ? » : chacun choisit son profil, derrière son code PIN s'il en a un. Le changement de profil reste dans le menu de votre avatar.",
    on: "Activé sur tous vos ordinateurs",
    off: "Désactivé",
    failed: "Le réglage n'a pas pu être enregistré. Réessayez.",
    stayHere: "Sur cet ordinateur, « Qui regarde ? » n'est plus proposé : le profil {{name}} s'ouvre directement.",
    stayHereReset: "Proposer à nouveau",
  },
} as const;
