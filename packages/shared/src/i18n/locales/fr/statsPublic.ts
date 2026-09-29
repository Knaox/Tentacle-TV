/**
 * La page PUBLIQUE des statistiques partagées (/share/:token, sans compte) —
 * à la troisième personne. Lue AVANT l'espace `stats` : une clé de même nom
 * remplace celle de la page du propriétaire (« Vos genres » → « Ses genres »),
 * les autres (mois, légendes, noms des traits) viennent de `stats`. `{{name}}`
 * est le nom du propriétaire. Jamais d'accord au genre : « Ses », « Son »,
 * « {{name}} », pas « il » ni « elle ».
 *
 * ⚠️ Aucun « téléchargement » ni « download » ici : le miroir téléphone lit
 * cette page.
 */
export default {
  kicker: "Statistiques partagées",
  title: "Les statistiques de {{name}}",
  periodNote_30d: "Ces 30 derniers jours",
  periodNote_year: "Cette année",
  periodNote_all: "Depuis le début",
  updated: "Chiffres du {{date}}",
  readOnlyNote: "Une page publique, en lecture seule : les chiffres que {{name}} a choisi de partager, et rien d'autre. Aucun film ni aucune série ne s'y lit.",
  footer: "Calculé par Tentacle TV sur un serveur privé. Restent privés : ses heures de visionnage, ses écrans, les dates exactes de ses séances et sa liste d'envies.",
  backToStats: "Toutes les statistiques",
  loading: "Chargement des statistiques…",

  heroLead_30d: "Ces 30 derniers jours, {{name}} a regardé",
  heroLead_year: "Cette année, {{name}} a regardé",
  heroLead_all: "Au total, {{name}} a regardé",
  sourceEstimated: "Estimé d'après son historique",
  littleHistory: "Encore quelques séances, et son profil se dessinera plus nettement.",

  personaTitle: "Son profil de spectateur",
  personaHint: "Tiré de ses habitudes sur la période",
  favoriteGenre: "Son genre de prédilection",
  favoriteGenreDetail: "{{share}} de son temps",
  badgeDetail_nightOwl: "{{share}} de son temps entre 22 h et 5 h",
  badgeDetail_earlyBird: "{{share}} de son temps avant 10 h",
  badgeDetail_weekend: "{{share}} de son temps le samedi et le dimanche",
  badgeDetail_cinephile: "{{share}} de son temps devant des films",
  badgeDetail_seriesAddict: "{{share}} de son temps devant des séries",
  badgeDetail_animeFan: "{{share}} de son temps devant des animés",
  badgeDetail_loyal: "{{share}} de son temps avec {{label}}",
  badgeDetail_vintage: "{{share}} de son temps devant les années {{label}}",

  activityTitle: "Son activité",
  momentsTitle: "À quel moment ?",
  momentsHint: "Part du temps mesuré par Tentacle, à l'heure de {{name}}",
  momentsHeadline_morning: "Plutôt le matin",
  momentsHeadline_afternoon: "Plutôt l'après-midi",
  momentsHeadline_evening: "Plutôt le soir",
  momentsHeadline_night: "Plutôt la nuit",
  moment_morning: "Matin",
  moment_afternoon: "Après-midi",
  moment_evening: "Soirée",
  moment_night: "Nuit",
  momentRange_morning: "5 h – 12 h",
  momentRange_afternoon: "12 h – 18 h",
  momentRange_evening: "18 h – 23 h",
  momentRange_night: "23 h – 5 h",
  momentsWeekend: "Le week-end",
  momentsWeekendLabel: "Samedi et dimanche",
  momentsEmpty: "Ses habitudes se dessineront avec le temps mesuré par Tentacle.",

  genresTitle: "Ses genres",
  originsHint: "Le pays où ses titres ont été produits",
  seriesTitle: "Ses séries",
  moviesTitle: "Ses films",
  moviesFavoritesTitle: "Ses films préférés",
  moviesHint_preference: "Classés par sa note, ses coups de cœur et ses favoris, puis ses revisionnages ; le temps passé départage.",
  moviesHint_time: "Classés au temps passé.",
  favoriteMovie: "Son film préféré",
  chipRating: "Sa note : {{rating}} sur 10",
  peopleTitle: "Ses têtes d'affiche",
  peopleHint: "Au nombre de titres où on les retrouve, puis au temps passé",
  decadesTitle: "Ses décennies",
  recordsTitle: "Ses records",
  recordBingeDetail: "{{series}} · {{episodes}} épisodes, en {{date}}",
  recordSessionDetail: "Devant {{title}}, en {{date}}",

  tasteTitle: "Ce que {{name}} aime",
  tasteHint: "Les titres qui pèsent le plus dans ses goûts",
  signalsTitle: "Ses avis",
  tasteAnime: "{{share}} d'animés dans ses goûts",

  aboutMeasured: "Depuis le {{date}}, Tentacle chronomètre ce que {{name}} regarde, quelle que soit l'application.",
  aboutCounts: "Les films et épisodes vus viennent de son historique Jellyfin.",
  aboutListening: "« VF ou VO ? » lit la piste audio que ses applications déclarent jouer, relevée depuis le {{date}} : rien n'est déduit pour les séances d'avant.",
  aboutMoments: "Les moments de la journée se lisent à l'heure de {{name}}, sur le temps mesuré par Tentacle.",

  emptyTitle: "{{name}} n'a encore rien regardé",
  emptyBody: "Ses statistiques apparaîtront ici au fil de ses séances.",
  periodEmptyTitle: "Rien de regardé sur cette période",
  periodEmptyBody: "{{name}} n'a rien regardé sur la période partagée.",
} as const;
