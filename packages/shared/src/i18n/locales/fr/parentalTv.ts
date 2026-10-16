/**
 * Le contrôle parental SIMPLIFIÉ sur la TV (Apple TV, Android TV) : l'âge
 * maximal en quelques paliers, les bibliothèques autorisées. Le reste (titres
 * sans classification, étiquettes, plages horaires) se règle sur le bureau ou
 * le web. C'est Jellyfin qui applique.
 */
export default {
  kicker: "Contrôle parental",
  title: "Ce que {{name}} peut regarder",
  subtitle: "Jellyfin l'applique aussitôt, sur tous ses appareils.",
  roles: {
    guest: "Invité",
    member: "Membre de la famille",
  },
  age: {
    title: "Âge maximal",
    allAges: "Tout public",
    years: "{{age}} ans",
    none: "Sans limite",
    custom: "Réglé ailleurs",
    summaryAllAges: "Les titres tout public seulement.",
    summaryYears: "Les titres jusqu'à {{age}} ans.",
    summaryNone: "Aucune limite d'âge.",
    summaryCustom: "« {{names}} », réglé sur le bureau ou le web.",
    summaryCustomUnnamed: "Une note réglée sur le bureau ou le web.",
    ceilingMember: "L'administrateur limite déjà ce compte à « {{names}} » : rien au-delà.",
    ceilingGuest: "Le compte qui a créé ce profil est limité à « {{names}} » : rien au-delà.",
    ceilingGuestNamed: "Le compte de {{creator}} est limité à « {{names}} » : rien au-delà.",
    selected: "retenu",
  },
  libraries: {
    title: "Bibliothèques",
    all: "Toutes",
    count: "{{on}} sur {{total}}",
    empty: "Aucune bibliothèque à régler.",
    allowed: "autorisée",
    hidden: "masquée",
    keepOne: "Gardez au moins une bibliothèque.",
  },
  more: {
    title: "Plus d'options sur le bureau ou le web",
    detail: "Titres sans classification, étiquettes, plages horaires.",
  },
  saving: "Enregistrement…",
  saved: "Enregistré — Jellyfin l'applique.",
  loadFailed: "Impossible de lire le contrôle parental de ce profil.",
  unavailable: "Ce serveur ne permet pas de régler ce profil depuis la TV.",
};
