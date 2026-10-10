import { useRef } from "react";
import { useLocation, type Location } from "react-router-dom";
import { usePipSession } from "./pictureInPictureStore";

/**
 * L'adresse de la PAGE à rendre — celle des routes de l'application.
 *
 * Pendant le PiP, une lecture lancée depuis l'application (fiche, carte…) passe
 * un instant par la route du lecteur avant que `PlayerStage` ne la confie au PiP
 * et ne rende la page parcourue. Les routes de l'application, elles, ne doivent
 * jamais la voir : changer de groupe de routes (`routeKeys.ts`) démontait la
 * page, puis la remontait au retour — l'accueil se rechargeait sous les yeux
 * (retour de Damien, Windows). Elles gardent donc la dernière page parcourue,
 * sauf à l'ouverture du PiP (la route qu'il garde) et au retour au lecteur.
 */
export function usePageLocation(): Location {
  const location = useLocation();
  const session = usePipSession();
  const lastPage = useRef<Location>(location);
  const onWatch = location.pathname.startsWith("/watch/");
  if (!onWatch) lastPage.current = location;
  // Une route du lecteur neuve, ou celle d'une lecture lancée que la session a
  // déjà reprise — la page parcourue n'est pas encore revenue (transition).
  const launchedInPip =
    onWatch && session !== null && session.returning !== true &&
    (location.key !== session.location.key || session.launched === true);
  return launchedInPip ? lastPage.current : location;
}
