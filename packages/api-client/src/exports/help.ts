// L'aide : le diagnostic des bandes-annonces du serveur, lu par le guide et par
// le rappel discret des fiches (cf. hooks/useTrailerReadiness), ce rappel
// lui-même (cf. hooks/useTrailerHint), et l'adresse du tableau de bord de
// Jellyfin pour les liens du guide (cf. hooks/useJellyfinDashboardUrl)
export {
  useTrailerReadiness, fetchTrailerReadiness, TRAILER_READINESS_KEY,
} from "../hooks/useTrailerReadiness";
export {
  useJellyfinDashboardUrl, fetchJellyfinDashboardUrl, JELLYFIN_DASHBOARD_URL_KEY,
} from "../hooks/useJellyfinDashboardUrl";
export { useTrailerHint, type TrailerHint, type UseTrailerHintInput } from "../hooks/useTrailerHint";
