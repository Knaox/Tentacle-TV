export default {
  // Clés existantes (jumelage local)
  pairDevice: "Jumeler un appareil",
  enterCode: "Saisissez le code de 4 caractères affiché sur votre TV.",
  pair: "Jumeler",
  pairing: "Jumelage...",
  pairSuccess: "Appareil « {{name}} » jumelé avec succès !",
  codeInvalid: "Code invalide ou expiré. Vérifiez le code sur votre TV et réessayez.",
  codeExpireNote: "Le code expire après 5 minutes. S'il a expiré, générez-en un nouveau.",
  tvPairTitle: "Jumeler cet appareil",
  tvPairInstructions: "Sur votre téléphone ou ordinateur, ouvrez Tentacle TV, allez dans Paramètres puis Jumeler la TV, et entrez ce code.",
  codeExpired: "Code expiré",
  expiresIn: "Expire dans {{time}}",
  generateNewCode: "Générer un nouveau code",
  pairingSuccess: "Jumelage réussi !",
  welcomeUser: "Bienvenue, {{username}}",
  howToConnect: "Comment souhaitez-vous vous connecter ?",
  pairWithCode: "Jumeler avec un code",
  pairWithCodeDesc: "Entrez un code depuis l'app web",
  manualLogin: "Se connecter manuellement",
  manualLoginDesc: "Saisir identifiant et mot de passe",
  checkServer: "Vérifier le serveur",
  serverConnected: "Serveur connecté avec succès !",
  tvRemoteHint: "Utilisez la télécommande pour saisir l'adresse de votre serveur.",
  changeServer: "Changer de serveur",

  // Jumelage relais (TV accueil)
  showPairingCode: "Afficher le code de jumelage",
  configureManually: "Configurer manuellement",
  tvWelcomeTitle: "Bienvenue sur Tentacle TV",
  tvWelcomeSubtitle: "Jumelez cet appareil pour commencer.",
  cancel: "Annuler",

  // Saisie d'un code de provisionnement (testeurs des stores TV)
  haveCode: "J'ai un code de jumelage",
  enterProvisioningTitle: "Saisir un code de jumelage",
  enterProvisioningSubtitle: "Saisissez le code à 12 caractères communiqué pour jumeler cet appareil.",
  validateCode: "Valider le code",
  checkingCode: "Vérification...",
  codeProgress: "{{count}} / {{total}} caractères",
  clearCode: "Effacer",
  enterCodeRemoteHint: "Utilisez la télécommande pour saisir le code, caractère par caractère. La validation est automatique.",

  // Jumelage relais (Web/Mobile saisie code)
  pairYourTV: "Jumeler votre TV",
  enterTVCode: "Saisissez le code de 4 caractères affiché sur votre TV.",
  pairTV: "Jumeler la TV",
  tvPairedSuccess: "TV jumelée avec succès !",
  relayError: "Impossible de joindre le service de jumelage. Réessayez plus tard.",

  // Gestion des appareils jumelés
  pairedDevices: "Appareils jumelés",
  noPairedDevices: "Aucun appareil jumelé.",
  lastActive: "Dernière activité : {{date}}",
  revoke: "Révoquer",

  // Bandeau « jumelage expiré » (token Jellyfin de l'appareil mort côté serveur)
  pairingExpiredBanner: "Jumelage expiré — reconfirmez le jumelage depuis votre profil pour réactiver la sauvegarde de progression.",

  // Jumelage indisponible (URL publique du serveur non configurée côté backend)
  pairingUnavailable: "Jumeler TV est indisponible, cette option doit être activée par l'administrateur.",
  pairingUnavailableAdmin: "Veuillez d'abord renseigner « URL publique du serveur Tentacle TV » pour activer le jumelage TV.",
  pairingConfigureNow: "Configurer maintenant",
  tvNonJumeleTitre: "Téléviseur non jumelé",
  tvNonJumeleTexte:
    "Cet appareil n'est plus associé à votre compte. Revenez à l'écran de jumelage pour afficher un nouveau code, puis validez-le depuis votre téléphone ou votre ordinateur.",
  tvNonJumeleAction: "Revenir au jumelage",

  // Section « Compte » des réglages du téléviseur.
  tvCompteJumele: "Compte jumelé",
  tvServeur: "Serveur",
  tvVersion: "Version",
  tvOublierTitre: "Oublier ce jumelage",
  tvOublierConfirmer: "Confirmer l'oubli",
  tvOublierTexte:
    "Ce téléviseur cessera d'être associé à votre compte et reviendra à l'écran de jumelage, où un nouveau code sera affiché.",
} as const;
