/**
 * L'assistant d'installation : le PARCOURS (`setupFlowContract.ts`) — le
 * Jellyfin choisi rappelé en tête de chaque écran, le choix sans rien
 * d'office, le compte créé (Jellyfin neuf) ou la connexion (Jellyfin déjà
 * configuré). Fondu dans l'espace `setupWizard` (`setupWizard.ts`).
 */
export default {
  chosenLabel: "Le Jellyfin choisi",
  chosenServer: "Jellyfin “{{name}}” · {{state}}",
  chosenState_fresh: "neuf",
  chosenState_configured: "déjà configuré",
  chosenInStack: "dans cette pile",

  jfRecommended: "Conseillé",
  jfPickFirst: "Choisissez un Jellyfin dans la liste pour continuer.",
  jfPickContinue: "Continuer",
  jfSelecting: "Vérification du Jellyfin choisi…",
  jfChangeNotice: "Vous aviez choisi “{{name}}”. En choisir un autre oublie ce que Tentacle avait préparé pour lui ; un compte déjà créé sur un Jellyfin y reste.",

  accountDone: "Le compte administrateur “{{name}}” est créé sur ce Jellyfin.",
  accountDoneAnonymous: "Le compte administrateur est créé sur ce Jellyfin.",
  accountDoneVerify: "Retapez son nom et son mot de passe pour continuer : le mot de passe n'est jamais enregistré.",
  accountVerify: "Vérifier",

  signInTitle: "Connectez-vous à ce Jellyfin",
  signInSubtitle: "Avec un compte administrateur qui existe déjà sur ce Jellyfin. Le mot de passe ne fait que passer : il n'est jamais enregistré.",
  signInNothingCreated: "Tentacle ne crée rien sur ce Jellyfin : ni compte, ni bibliothèque.",
  signInDone: "Connecté à ce Jellyfin en tant que “{{name}}”.",
  signInOther: "Utiliser un autre compte",

  dbDone: "La base de données est reliée.",
  recapLibrariesExisting: "Aucune création — déjà dans Jellyfin : {{names}}",
};
