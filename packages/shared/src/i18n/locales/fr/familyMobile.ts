/**
 * La Famille sur le mobile et l'iPad : les seuls mots propres à leurs écrans.
 * Le reste vient de `family` (commun à tous les clients) et de `familyWeb`
 * (la page et l'affiche, mêmes gestes qu'au web). Le mobile lit ces trois
 * espaces : le mot « téléchargement » n'y entre pas (`familyMobileVocabulary.test.ts`).
 */
export default {
  inviteHint: "Un compte de ce serveur : il répond depuis son application.",
  addGuestHint: "Un profil sans mot de passe, qui s'ouvre sur les appareils de la famille depuis « Qui regarde ? ».",
  /** La validation de la feuille « invité », à côté de son titre : un mot. */
  create: "Créer",
  openProfileHint: "Ouvre les réglages de ce profil",
  posterLabel: "Invitation à rejoindre une famille",
  pinShow: "Afficher les chiffres",
  pinHide: "Masquer les chiffres",
  // v2 — ce que seul le mobile dit (les mots communs vivent dans `family`).
  memberMayCreate: "Le propriétaire vous permet de créer des invités : vous gérez ceux que vous créez.",
  /** « Qui regarde ? » sur le mobile et l'iPad (serveur 1.31.1, `family.mobileProfiles`). */
  launch: {
    caption: "Cet appareil retiendra votre choix. Pour changer de profil : Réglages › Compte.",
    switchCaption: "Le profil choisi s'ouvre sur cet appareil, et y reste jusqu'au prochain changement.",
    cancel: "Annuler",
    guest: "Invité",
    owner: "Propriétaire",
    member: "Membre",
    opening: "Ouverture…",
    loading: "Lecture des profils de la famille…",
  },
  /** Le premier lancement, après la connexion : code PIN, accueil, photo — chaque étape se passe. */
  firstRun: {
    step: "Étape {{current}} sur {{total}}",
    skip: "Passer",
    next: "Continuer",
    finish: "Terminer",
    pinTitle: "Protégez votre profil",
    pinBody: "Un code PIN à quatre chiffres empêche les autres membres de la famille d'ouvrir votre profil, ici comme sur les autres appareils de la famille.",
    pinSet: "Poser un code PIN",
    pinDone: "Code PIN posé.",
    homeTitle: "Votre accueil",
    homeBody: "Choisissez les rangées de l'accueil et leur ordre. Elles suivent votre compte : le web et l'ordinateur montrent les mêmes. Tout se change ensuite dans Réglages.",
    homeLoading: "Lecture de votre accueil…",
    homeUnavailable: "Votre accueil n'a pas pu être lu. Vous le réglerez plus tard dans Réglages.",
    photoTitle: "Votre photo",
    photoBody: "Choisissez un personnage ou importez une photo : elle vous suit sur tous vos appareils, TV comprises.",
    photoChoose: "Choisir ma photo",
    photoDone: "Photo choisie.",
  },
  /** La feuille « Changer de profil » (en-tête, Réglages › Compte, onglet Profil). */
  switcher: {
    back: "Profils",
    switched: "Vous regardez sur le profil de {{name}}",
    close: "Fermer",
  },
} as const;
