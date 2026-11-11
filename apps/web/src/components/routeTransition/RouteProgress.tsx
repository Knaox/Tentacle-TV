import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { isRouteHeld, subscribeRouteHold } from "./routeHold";
import "./routeProgress.css";

/**
 * En deçà, une navigation est immédiate et n'a rien à dire : la barre ne paraît que si la page
 * quittée attend encore après ce délai (l'onglet courant, lui, a changé dès le clic).
 */
export const ROUTE_PROGRESS_AFTER_MS = 300;

const notHeld = (): boolean => false;

/**
 * « La page arrive » : une barre fine en haut de la fenêtre, quand une navigation attend plus
 * qu'un instant — un serveur lent, une première visite. Le pendant de la tenue de la page
 * quittée (`RouteExit`) : rien ne clignote, et le clic se sait entendu.
 */
export function RouteProgress() {
  const held = useSyncExternalStore(subscribeRouteHold, isRouteHeld, notHeld);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!held) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), ROUTE_PROGRESS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [held]);

  return shown ? <ProgressBar /> : null;
}

/** La barre elle-même : montée seulement quand elle se montre — ses mots ne se lisent qu'alors. */
function ProgressBar() {
  const { t } = useTranslation("common");
  return (
    <div className="route-progress" role="progressbar" aria-busy="true" aria-label={t("pageLoading")}>
      <i />
    </div>
  );
}
