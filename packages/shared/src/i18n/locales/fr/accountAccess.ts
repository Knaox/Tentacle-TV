/**
 * La page d'un compte BLOQUÉ (désactivé, hors plage) et les connexions refusées —
 * web, bureau, Apple TV (docs/DROITS-UTILISATEURS.md § 9.1). Mêmes clés et mêmes
 * variables en anglais (`accountAccessVocabulary.test.ts`).
 */
export default {
  disabled: {
    title: "Ce compte a été désactivé",
    body: "L'administrateur du serveur a désactivé ce compte. Tentacle n'est plus disponible pour lui tant qu'il ne l'aura pas réactivé.",
  },
  lockedOut: {
    title: "Ce compte est bloqué",
    body: "Ce compte est bloqué après trop d'essais de mot de passe. Contactez l'administrateur du serveur pour le débloquer.",
  },
  outsideSchedule: {
    title: "Tentacle n'est pas disponible pour ce compte en ce moment",
    body: "L'administrateur du serveur a fixé les heures où ce compte peut utiliser Tentacle.",
  },
  schedulesTitle: "Heures autorisées",
  days: {
    Everyday: "Tous les jours",
    Weekday: "Du lundi au vendredi",
    Weekend: "Le week-end",
    Monday: "Le lundi",
    Tuesday: "Le mardi",
    Wednesday: "Le mercredi",
    Thursday: "Le jeudi",
    Friday: "Le vendredi",
    Saturday: "Le samedi",
    Sunday: "Le dimanche",
  },
  range: "de {{from}} à {{to}}",
  midnight: "minuit",
  reopening: {
    today: "Tentacle rouvre aujourd'hui à {{time}}.",
    tomorrow: "Tentacle rouvre demain à {{time}}.",
    later: "Tentacle rouvre {{day}} à {{time}}.",
    never: "Aucune heure n'est ouverte pour ce compte.",
    unknown: "Tentacle rouvrira pour ce compte aux heures fixées par l'administrateur.",
  },
  footer: "Cette page disparaîtra d'elle-même dès que l'accès sera rétabli.",
  footerDisabled: "Une fois le compte réactivé, il faudra peut-être vous reconnecter.",
  actions: {
    signOut: "Se déconnecter",
    changeServer: "Changer de serveur",
    switchProfile: "Changer de profil",
    unpair: "Se déconnecter du serveur",
  },
  refusals: {
    account_disabled: "Ce compte a été désactivé par l'administrateur du serveur.",
    account_locked_out: "Ce compte est bloqué après trop d'essais. Contactez l'administrateur.",
    account_outside_schedule: "Ce compte ne peut pas se connecter à cette heure-ci : l'administrateur a fixé ses heures d'accès.",
    account_max_sessions_one: "Ce compte est déjà connecté sur {{count}} appareil, le maximum autorisé par l'administrateur.",
    account_max_sessions_other: "Ce compte est déjà connecté sur {{count}} appareils, le maximum autorisé par l'administrateur.",
  },
} as const;
