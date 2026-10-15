import { acceptRecoPageThemes } from "@tentacle-tv/api-client";

/**
 * Le téléviseur titre une rangée À THÈME par son `why` (`recoRowTitleText`) :
 * il demande donc ces rangées au serveur (`?themes=1`) — « Films pour vous »
 * (rangée de l'accueil épinglable depuis le bureau, `reco.moviesRow`), « Avec
 * {acteur} ». Sans cela, le serveur ne les lui servait pas : épinglée, la
 * rangée manquait à l'accueil de l'Apple TV. Posé au chargement, avant toute
 * requête (`index.js`) : toutes les pages en cache sont demandées ainsi.
 */
acceptRecoPageThemes();
