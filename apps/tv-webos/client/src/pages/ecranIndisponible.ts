import { createElement, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

/**
 * Écran servi aux routes qui n'existent pas sur un téléviseur.
 *
 * Les écrans hors périmètre — administration, téléchargements, partage,
 * tickets — sont retirés du bundle, pas masqués : leur code n'est jamais
 * compilé. Leurs routes, elles, restent déclarées par `App.tsx`, et un lien
 * interne peut encore y mener. Plutôt qu'une page blanche, on explique.
 *
 * Écrit en `createElement` : le JSX de cette application vit dans `apps/web`,
 * la cible téléviseur n'en contient pas.
 */
export function EcranIndisponible(): ReactElement {
  const { t } = useTranslation("common");

  return createElement(
    "div",
    { className: "flex min-h-screen flex-col items-center justify-center gap-4 px-16 text-center" },
    createElement(
      "h1",
      { className: "text-3xl font-semibold text-content-primary" },
      t("tvIndisponibleTitre"),
    ),
    createElement(
      "p",
      { className: "max-w-2xl text-lg text-content-secondary" },
      t("tvIndisponibleTexte"),
    ),
  );
}

export default EcranIndisponible;
