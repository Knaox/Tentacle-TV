/**
 * Les extensions recommandées de la vue d'ensemble : ce qu'elles apportent,
 * leur installation en un clic, et le formulaire GÉNÉRIQUE qu'une extension
 * déclare pour se brancher (`setup` de son manifeste). Les textes d'une
 * extension se rangent sous `rec_<pluginId>_*` ; le formulaire, lui, prend ses
 * mots dans le manifeste.
 */
export default {
  title: "Extensions recommandées",
  description: "Des extensions de Tentacle qui s'installent en un clic depuis le catalogue, puis se branchent ici même.",

  rec_seer_name: "Vigie",
  rec_seer_pitch: "Vos utilisateurs demandent films et séries depuis Tentacle, suivent leur arrivée et voient les prochaines sorties.",
  rec_seer_benefit1: "Un bouton « Demander » sur les titres absents du serveur",
  rec_seer_benefit2: "Le demandeur est prévenu dès que le titre arrive",
  rec_seer_benefit3: "Le calendrier des prochaines sorties",
  rec_seer_needs: "Il faut une instance Jellyseerr ou Overseerr.",

  statusMissing: "Non installée",
  statusDisabled: "Désactivée",
  statusRestart: "Redémarrage du serveur requis",
  statusFailed: "Module serveur en échec",
  statusSetup: "À brancher",
  statusReady: "Prête",
  install: "Installer {{name}}",
  installing: "Installation…",
  enable: "Activer",
  enabling: "Activation…",
  configure: "Configurer",
  settings: "Réglages",
  open: "Ouvrir {{name}}",
  notFound: "Introuvable dans le catalogue de vos sources.",
  showSources: "Voir les sources",
  catalogError: "Le catalogue ne répond pas : réessayez dans un instant.",
  restartBody: "Le serveur Tentacle doit redémarrer pour charger l'extension — le bandeau ci-dessus le propose.",
  failedBody: "Le module serveur de l'extension n'a pas démarré.",
  manage: "Gérer dans Plugins",
  readyBody: "Branchée et active.",

  // Le formulaire générique d'une extension
  setupTest: "Tester",
  setupTesting: "Test en cours…",
  setupSave: "Tester et activer",
  setupSaving: "Activation…",
  setupKeep: "Enregistrée — laisser vide pour la garder",
  setupShowSecret: "Afficher",
  setupHideSecret: "Masquer",
  setupOk: "Test réussi",
  setupOkVersion: "Test réussi — version {{version}}",
  setupSaved: "{{name}} est branchée et active.",
  setupRequired: "Ce champ est requis.",
  setupInvalidUrl: "Adresse invalide : elle commence par http:// ou https://",
  setupNotRunning: "Le module serveur de l'extension ne tourne pas encore : redémarrez le serveur Tentacle.",
  setupFailed: "Le test a échoué.",
  setupUnreachable: "Le serveur Tentacle ne répond pas.",
  setupLoadError: "Impossible de lire la configuration de l'extension.",
  setupRetry: "Réessayer",
  setupOtherSettings: "Autres réglages",
};
