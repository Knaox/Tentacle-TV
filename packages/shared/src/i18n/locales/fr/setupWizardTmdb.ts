/**
 * L'assistant d'installation : l'écran de la clé TMDB (facultatif, dans les
 * deux parcours, juste avant le récapitulatif) et sa ligne au récapitulatif.
 * Ce que la clé apporte vraiment : les recommandations riches (« Pour vous »,
 * profil de goût, titres similaires, acteurs), les sagas complètes, les
 * plateformes de streaming et les affiches hors bibliothèque. Fondu dans
 * `setupWizard`.
 */
export default {
  step_tmdb: "Clé TMDB",
  tmdbTitle: "Clé TMDB (facultatif)",
  tmdbSubtitle: "The Movie Database complète ce que Jellyfin sait de vos films et séries. Une clé gratuite suffit.",
  tmdbBenefitsLabel: "Avec une clé, Tentacle ajoute",
  tmdbBenefit_reco: "Des recommandations « Pour vous » propres à chaque compte : titres similaires, acteurs, goûts",
  tmdbBenefit_sagas: "Les sagas complètes, avec les volets qui manquent à la bibliothèque",
  tmdbBenefit_providers: "Les plateformes de streaming de chaque titre, et le filtre par plateforme",
  tmdbBenefit_artwork: "Les affiches des titres hors de votre bibliothèque",
  tmdbWithout: "Sans clé, tout fonctionne : les recommandations retombent sur les genres de votre bibliothèque.",
  tmdbKeyLabel: "Clé API (v3)",
  tmdbKeyPlaceholder: "Collez la clé API v3",
  tmdbKeyShow: "Afficher la clé",
  tmdbKeyHide: "Masquer la clé",
  tmdbKeyHintV4:
    "Ceci ressemble au jeton d'accès v4 (« API Read Access Token »). Tentacle attend la clé API v3 : 32 caractères, juste au-dessus sur la même page de TMDB.",
  tmdbKeyHintFormat: "Une clé v3 compte 32 caractères : des chiffres et les lettres de a à f.",
  tmdbGetKey: "Créer une clé gratuite sur themoviedb.org",
  tmdbSave: "Vérifier et continuer",
  tmdbChecking: "Vérification auprès de TMDB…",
  tmdbLater: "Configurer plus tard",
  tmdbLaterHint: "Vous la poserez dans Administration › Métadonnées ; le tableau de bord la garde dans ses recommandations.",
  tmdbSaved: "Clé TMDB enregistrée (se terminant par {{last4}}).",
  tmdbFromEnv: "Clé TMDB fournie par la variable TMDB_API_KEY du serveur (se terminant par {{last4}}) : rien à saisir.",
  tmdbReplace: "Utiliser une autre clé",
  recapTmdb: "Clé TMDB",
  recapTmdbSaved: "Enregistrée (…{{last4}})",
  recapTmdbEnv: "Fournie par le serveur (…{{last4}})",
  recapTmdbLater: "Plus tard — Administration › Métadonnées",
};
