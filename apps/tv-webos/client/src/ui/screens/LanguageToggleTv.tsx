import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * La bascule de langue de l'écran de jumelage.
 *
 * Reprise de `WelcomeStep` d'Android TV : en haut à droite, et elle affiche la
 * langue vers laquelle elle mène — « EN » quand on est en français. C'est la
 * convention des sélecteurs à deux états : le libellé est l'action, pas l'état.
 *
 * **Elle n'existe qu'ici, et c'est voulu.** Une fois jumelé, la langue se règle
 * dans les préférences, côté serveur, et suit le compte d'un appareil à
 * l'autre. Avant le jumelage il n'y a pas de compte : la langue vient de celle
 * du téléviseur, et si elle est fausse l'écran de code devient illisible sans
 * aucun moyen d'en sortir. C'est le seul écran de l'application où l'on ne peut
 * pas se rattraper ailleurs.
 *
 * Le choix est mémorisé sous la même clé que partout — `tentacle_language` —
 * donc il survit au jumelage et le client démarre dans la bonne langue.
 */
export function LanguageToggleTv() {
  const { i18n } = useTranslation();
  const current2 = i18n.language?.slice(0, 2) === "fr" ? "fr" : "en";
  const target = current2 === "fr" ? "en" : "fr";

  const toggle = useCallback(() => {
    void i18n.changeLanguage(target);
    try {
      localStorage.setItem("tentacle_language", target);
    } catch {
      // Stockage indisponible : la langue tiendra pour cette session-ci.
    }
  }, [i18n, target]);

  return (
    <div className="bascule-langue">
      <button type="button" className="bouton-lien" onClick={toggle}>
        {target.toUpperCase()}
      </button>
    </div>
  );
}
