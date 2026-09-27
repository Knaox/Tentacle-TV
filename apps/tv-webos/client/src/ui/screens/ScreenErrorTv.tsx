import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TentacleLogo } from "@/components/ui/TentacleLogo";
import { isModuleLoadFailure, reloadForStaleBuild } from "@/lib/staleBuildReload";
import { DEFAULT_ATTRIBUTE } from "../../focus/default";

/** Les écrans d'où « Retour » rend la main au téléviseur (cf. `focus/back.ts`). */
const ROOT_PATHS = ["/tv", "/tv/"];

interface ScreenErrorTvProps {
  error: Error;
  /** Remonte l'écran tel quel — pour une erreur de rendu, pas un module absent. */
  onRetry: () => void;
}

/**
 * Ce qu'on montre à la place d'un écran qui n'a pas pu s'afficher.
 *
 * **Deux pannes, deux remèdes.** Un MODULE introuvable ne se retente pas dans le
 * document : Chromium garde l'échec d'un import en mémoire — mesuré au
 * simulateur webOS 25, le second `import()` de la même adresse est rejeté sans
 * même refaire la requête. Seul un rechargement le répare ; il est programmé
 * dès l'affichage et part quand le serveur répond (`staleBuildReload`).
 * « Réessayer » le demande de nouveau en passant outre l'anti-boucle. Une
 * erreur de RENDU, elle, se retente sur place : l'écran est remonté.
 *
 * **Le focus est posé ici.** Le moteur ne place le focus qu'en arrivant sur un
 * écran, et l'erreur survient souvent sur la même adresse, après le délai de
 * grâce de la pose : sans ce geste, l'anneau restait sur `<body>` et la
 * télécommande n'avait plus rien à viser.
 *
 * Le détail technique s'affiche en petit : c'est la seule trace qu'un
 * utilisateur puisse transmettre d'un incident survenu devant sa télévision
 * (et `screenErrorLog` le garde pour l'inspecteur).
 */
export function ScreenErrorTv({ error, onRetry }: ScreenErrorTvProps) {
  const { t } = useTranslation("common");
  const moduleFailure = isModuleLoadFailure(error);
  const [reloadPlanned, setReloadPlanned] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (moduleFailure) setReloadPlanned(reloadForStaleBuild());
  }, [moduleFailure]);

  useEffect(() => {
    primary.current?.focus();
  }, []);

  const retry = useCallback(() => {
    if (moduleFailure) setReloadPlanned(reloadForStaleBuild({ force: true }));
    else onRetry();
  }, [moduleFailure, onRetry]);

  const goBack = useCallback(() => window.history.back(), []);
  const onRoot = ROOT_PATHS.indexOf(window.location.pathname) >= 0;

  const title = moduleFailure ? t("tvScreenLoadTitle") : t("tvScreenErrorTitle");
  const text = !moduleFailure
    ? t("tvScreenErrorText")
    : reloadPlanned
      ? t("tvScreenLoadWaiting")
      : t("tvScreenLoadText");

  return (
    <div className="screen-error-tv" role="alert">
      <div className="screen-error-card">
        <TentacleLogo size="lg" variant="bare" />
        <h1 className="screen-error-title">{title}</h1>
        <p className="screen-error-text">{text}</p>
        <div className="screen-error-actions">
          <button
            ref={primary}
            type="button"
            className="screen-error-button screen-error-primary"
            {...{ [DEFAULT_ATTRIBUTE]: "" }}
            onClick={retry}
          >
            {t("retry")}
          </button>
          {!onRoot && (
            <button type="button" className="screen-error-button" onClick={goBack}>
              {t("back")}
            </button>
          )}
        </div>
        <p className="screen-error-detail">
          {error.name}: {error.message.slice(0, 160)}
        </p>
      </div>
    </div>
  );
}
