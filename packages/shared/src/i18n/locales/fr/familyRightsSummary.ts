/**
 * Le résumé des droits d'un profil de la famille, en lecture seule (mobile,
 * tablette, web étroit) : `family/familyRightsSummary.ts` rend les clés. Les
 * droits se RÈGLENT au bureau ou sur le web. Lu par le mobile : le mot
 * « téléchargement » n'y entre pas (`familyRightsSummaryVocabulary.test.ts`).
 */
export default {
  title: "Ses droits",
  editElsewhere: "Modifier sur le bureau ou le web",
  /** Une partie se règle ici (âge, bibliothèques, interrupteurs) : le reste. */
  otherTitle: "Autres droits",
  moreElsewhere: "Plus de réglages sur le bureau ou le web",
  moreHint: "Titres sans classification, étiquettes et horaires se règlent dans Réglages › Famille, depuis l'app pour ordinateur ou le site de votre serveur.",
  editHint: "Les droits se règlent dans Réglages › Famille, depuis l'app pour ordinateur ou le site de votre serveur. Ils s'appliquent aussitôt sur tous ses appareils.",
  loading: "Lecture des droits…",
  libraries: {
    all: "Toutes les bibliothèques",
    one: "Une seule bibliothèque : {{names}}",
    some: "{{count}} bibliothèques sur {{total}} : {{names}}",
    none: "Aucune bibliothèque",
  },
  age: {
    none: "Aucune limite d'âge",
    allAudiences: "Tout public seulement",
    upTo: "Jusqu'à {{age}} ans",
  },
  unrated: "Titres sans classification bloqués",
  tags: "Étiquettes bloquées : {{count}}",
  schedule: "Horaires limités",
  requestTitles: {
    on: "Peut demander des films",
    off: "Ne peut pas demander de films",
    suspended: "Demandes suspendues par l'administration",
  },
  createGuests: {
    on: "Peut créer des invités",
    off: "Ne crée pas d'invités",
  },
  parent: "Parent : gère les profils des mineurs",
  watchTogether: { guest: "Pas de Watch Together" },
  offline: { guest: "Aucun titre gardé hors ligne" },
  account: "Watch Together, hors ligne et partage suivent son compte, réglé par l'administrateur.",
} as const;
