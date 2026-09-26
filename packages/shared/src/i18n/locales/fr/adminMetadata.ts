/**
 * Admin → Métadonnées : la clé TMDB, le calcul des recommandations et la
 * région des plateformes. Le libellé du rail (`admin:metadataTitle`) et le
 * bandeau « clé manquante » (`admin:tmdbKey*`) restent dans `admin`.
 */
export default {
  title: "Métadonnées",
  description:
    "Ce qui enrichit Tentacle au-delà de Jellyfin : TMDB pour les recommandations, et le pays dont les plateformes de streaming s'affichent.",
  loadError: "Impossible de lire la configuration des métadonnées.",
  loadErrorHint: "Le serveur Tentacle n'a pas répondu. Vérifiez la connexion, puis réessayez.",
  retry: "Réessayer",
  // Carte TMDB
  tmdbTitle: "TMDB",
  tmdbSubtitle: "The Movie Database",
  tmdbDescription:
    "Alimente les recommandations riches — titres similaires, acteurs, mots-clés, affiches hors bibliothèque — et la synchronisation anonyme des notes. Sans clé, le moteur retombe sur les genres de la bibliothèque, pour tous les comptes.",
  tmdbGetKey: "Créer une clé gratuite sur themoviedb.org",
  statusConfigured: "Configurée",
  statusMissing: "Non configurée",
  statusRejected: "Refusée par TMDB",
  keySaved: "Clé enregistrée",
  keyEndsWith: "Clé se terminant par {{last4}}",
  keySourceDb: "saisie ici",
  keySourceEnv: "variable d'environnement",
  keyEnvNote:
    "Définie par la variable d'environnement TMDB_API_KEY du serveur, prioritaire sur toute saisie ici. Pour la changer, modifiez-la puis redémarrez le serveur.",
  keyLabel: "Clé API (v3)",
  keyNewLabel: "Nouvelle clé API (v3)",
  keyPlaceholder: "Collez la clé API v3",
  keyShow: "Afficher la clé",
  keyHide: "Masquer la clé",
  keyHintV4:
    "Ceci ressemble au jeton d'accès v4 (« API Read Access Token »). Tentacle attend la clé API v3 : 32 caractères, juste au-dessus sur la même page de TMDB.",
  keyHintFormat: "Une clé v3 compte 32 caractères : des chiffres et les lettres de a à f.",
  test: "Tester",
  testSaved: "Tester la clé",
  save: "Enregistrer",
  cancel: "Annuler",
  replace: "Remplacer",
  remove: "Retirer",
  testValid: "TMDB accepte cette clé.",
  testValidSaved: "TMDB accepte la clé enregistrée.",
  testInvalid: "TMDB refuse cette clé : vérifiez qu'il s'agit bien de la clé API v3.",
  testInvalidSaved: "TMDB refuse la clé enregistrée — révoquée ou régénérée depuis ? Remplacez-la.",
  testUnreachable:
    "TMDB ne répond pas au serveur : la clé n'a pas pu être vérifiée. Vérifiez sa connexion à Internet, puis réessayez.",
  testUnsupported: "Le test demande un serveur Tentacle plus récent.",
  testFailed: "Le test n'a pas pu aboutir.",
  saveInvalid: "TMDB refuse cette clé — rien n'a été enregistré.",
  saveUnreachable: "TMDB ne répond pas au serveur — rien n'a été enregistré. Réessayez dans un instant.",
  saveFailed: "Échec de l'enregistrement.",
  keySavedToast: "Clé TMDB enregistrée.",
  removeConfirmTitle: "Retirer la clé TMDB ?",
  removeConfirmMessage:
    "Les recommandations redeviennent génériques pour tous les comptes : ni « Pour vous », ni profil de goût, ni filtres par plateforme. Vous pourrez remettre une clé à tout moment.",
  removeConfirm: "Retirer la clé",
  removeFailed: "La clé n'a pas pu être retirée.",
  keyRemovedToast: "Clé TMDB retirée.",
} as const;
