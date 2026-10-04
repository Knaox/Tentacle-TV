/**
 * La Famille sur le mobile et l'iPad : les seuls mots propres à leurs écrans.
 * Le reste vient de `family` (commun à tous les clients) et de `familyWeb`
 * (la page et l'affiche, mêmes gestes qu'au web). Le mobile lit ces trois
 * espaces : le mot « téléchargement » n'y entre pas (`familyMobileVocabulary.test.ts`).
 */
export default {
  inviteHint: "Un compte de ce serveur : il répond depuis son application.",
  addGuestHint: "Un profil sans mot de passe, qui ne s'ouvre que sur vos TV.",
  /** La validation de la feuille « invité », à côté de son titre : un mot. */
  create: "Créer",
  openProfileHint: "Ouvre les réglages de ce profil",
  posterLabel: "Invitation à rejoindre une famille",
  pinShow: "Afficher les chiffres",
  pinHide: "Masquer les chiffres",
  // v2 — ce que seul le mobile dit (les mots communs vivent dans `family`).
  memberMayCreate: "Le propriétaire vous permet de créer des invités : vous gérez ceux que vous créez.",
} as const;
