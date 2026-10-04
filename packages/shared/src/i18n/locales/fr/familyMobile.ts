/**
 * La Famille sur le mobile et l'iPad : les seuls mots propres à leurs écrans.
 * Le reste vient de `family` (commun à tous les clients) et de `familyWeb`
 * (la page et l'affiche, mêmes gestes qu'au web). Le mobile lit ces trois
 * espaces : le mot « téléchargement » n'y entre pas (`familyMobileVocabulary.test.ts`).
 */
export default {
  inviteHint: "Un compte de ce serveur : il répond depuis son application.",
  addGuestHint: "Un profil sans mot de passe, qui ne s'ouvre que sur vos TV.",
  manage: "Gérer",
  manageTitle: "Profil invité « {{name}} »",
  sent: "Envoyée",
  posterLabel: "Invitation à rejoindre une famille",
  pinShow: "Afficher les chiffres",
  pinHide: "Masquer les chiffres",
} as const;
