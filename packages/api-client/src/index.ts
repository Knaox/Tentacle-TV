// L'API publique de l'api-client, rangée par domaine : chaque sous-baril de
// `exports/` réunit les modules d'un domaine, et l'index ne fait que les
// rassembler. Un nom ne sort que par UN sous-baril — deux `export *` qui le
// fourniraient le rendraient ambigu (TS2308).
export * from "./exports/library"; // Client Jellyfin, navigation, recherche, personnes
export * from "./exports/saga"; // Saga d'un film, en bibliothèque et hors bibliothèque
export * from "./exports/collections"; // Ma liste, favoris, « vu », gestes en lot, cache
export * from "./exports/cards"; // Marqueurs et survol des cartes média
export * from "./exports/playback"; // Lecture, segments, overlay, débit
export * from "./exports/app"; // Session, configuration, stockage, mode, réseau
export * from "./exports/preferences"; // Langues par bibliothèque et par contenu
export * from "./exports/support"; // Tickets de support
export * from "./exports/notifications"; // Notifications et push
export * from "./exports/realtime"; // Socket partagé, canal de session, télécommande
export * from "./exports/social"; // Watch Together (REST) et partage de liste
export * from "./exports/pairing"; // Jumelage d'appareils, local et relais
export * from "./exports/ratings"; // Notes et comptes externes
export * from "./exports/reco"; // Recommandations
export * from "./exports/swipe"; // « Affiner » et affinité de groupe
export * from "./exports/home"; // Accueil configurable et préférences en direct
export * from "./exports/titles"; // Titres hors bibliothèque
export * from "./exports/stats"; // Statistiques de visionnage
export * from "./exports/help"; // Aide : diagnostic des bandes-annonces
