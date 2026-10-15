/**
 * Réglages › Personnalisation, partie « Accueil » — web, bureau, mobile,
 * Apple TV et Android TV : les sources du bandeau principal, dites par ce
 * qu'elles MONTRENT (`hero/heroModes.ts` donne la clé de chaque source), et
 * les titres des groupes de l'écran.
 *
 * Espaces insécables (U+00A0) devant « : », « ? » et « ! ».
 */
export default {
  // ── Le bandeau principal ────────────────────────────────────────────────
  heroTitle: "Bandeau principal",
  heroCaption: "Le grand carrousel en haut de l'accueil. Réglé pour votre compte : vos autres appareils suivent.",
  heroResume: "Reprendre",
  heroResumeHint: "Les films et épisodes que vous avez commencés, pour reprendre en un geste.",
  heroRandom: "Au hasard",
  heroRandomHint: "Des titres de votre bibliothèque tirés au hasard, différents à chaque visite.",
  heroReco: "Pour vous",
  heroRecoHint: "Une sélection de vos recommandations, films et séries mêlés, qui change à chaque visite.",
  heroRecoMovies: "Pour vous — Films",
  heroRecoMoviesHint: "Les films les mieux recommandés pour vous, du meilleur au suivant.",
  heroRecoSeries: "Pour vous — Séries",
  heroRecoSeriesHint: "Les séries les mieux recommandées pour vous, de la meilleure à la suivante.",
  heroFixed: "Un titre choisi",
  heroFixedHint: "Toujours le même titre, choisi parmi vos favoris.",
  /** Le titre choisi, dit sous la source. */
  heroFixedCurrent: "Titre à l'affiche : {{title}}",
  heroFixedChange: "Changer de titre",
  heroFixedPickTitle: "Titre à l'affiche",
  heroFixedPickContext: "Parmi vos favoris",
  heroFixedNoFavorites: "Ajoutez d'abord un titre à vos favoris pour l'afficher ici.",
  /** Ce qui se passe quand la source n'a rien à montrer. */
  heroFallbackNote: "Sans recommandation à montrer, le bandeau affiche vos reprises.",
  /** La légende de l'onglet des téléviseurs : la source en vigueur. */
  heroCurrent: "Bandeau : {{source}}",

  // ── Les groupes de l'écran ──────────────────────────────────────────────
  rowsTitle: "Rangées de l'accueil",
  rowsCaption: "Les rangées sous le bandeau, dans l'ordre où elles s'affichent. Masquer une rangée ne la supprime pas.",
  densityTitle: "Taille des cartes",
  densityCaption: "La taille des affiches dans les rangées de l'accueil.",
  /** L'onglet des téléviseurs. */
  tabTitle: "Personnalisation",
};
