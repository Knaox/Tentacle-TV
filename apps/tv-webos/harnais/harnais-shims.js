/**
 * Les béquilles communes des pages de harnais, pour un navigateur de test qui
 * pilote la page SANS l'afficher. Deux infirmités d'un document caché, deux
 * remèdes — une page visible garde les comportements natifs :
 *
 * - les `requestAnimationFrame` n'y tirent jamais : rejoués en microtâche,
 *   même sémantique « au prochain tour », sans compositeur ;
 * - un document privé du focus système n'émet AUCUN événement de focus —
 *   `document.activeElement` change, `focusin` ne part pas, et les mémoires du
 *   moteur, qui s'écrivent sur cet événement, resteraient vides. On le
 *   synthétise après chaque prise de focus réussie.
 *
 * S'y ajoutent les deux mains du banc d'essai : `__appui` envoie une touche,
 * `__ou` relève l'élément focalisé et le défilement.
 */
if (document.hidden) {
  window.requestAnimationFrame = (rappel) => {
    Promise.resolve().then(() => rappel(performance.now()));
    return 0;
  };

  const focusNatif = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (options) {
    focusNatif.call(this, options);
    if (document.activeElement === this) {
      this.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    }
  };
}

/**
 * Rejouer le `focus()` de Chrome 53, que le navigateur de mise au point n'a
 * plus. Deux différences, et ce sont elles qui produisaient le défaut le plus
 * coûteux du portage :
 *
 *   - `preventScroll` n'existe pas et l'option est ignorée ;
 *   - un élément PARTIELLEMENT visible est RECENTRÉ verticalement, là où un
 *     moteur récent l'amène au plus court.
 *
 * Avec cette simulation active, un moteur qui ne reprend pas la main sur le
 * cadrage fait redescendre l'anneau d'un demi-écran quand on remonte une
 * liste. C'est exactement ce qu'on veut pouvoir constater ici plutôt qu'à
 * trois mètres d'une dalle.
 */
window.__simulerChrome53 = () => {
  const focusNatif = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function () {
    focusNatif.call(this);
    const rect = this.getBoundingClientRect();
    const vue = window.innerHeight;
    const entier = rect.top >= 0 && rect.bottom <= vue;
    if (!entier && rect.height < vue) {
      window.scrollBy(0, rect.top - (vue - rect.height) / 2);
    }
    if (document.hidden && document.activeElement === this) {
      this.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    }
  };
};

window.__appui = (key, keyCode) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key, keyCode, bubbles: true, cancelable: true }));

window.__ou = () => {
  const element = document.activeElement;
  if (!element || element === document.body) return null;
  const rect = element.getBoundingClientRect();
  return {
    cle:
      element.getAttribute("data-tv-cle") ||
      element.getAttribute("data-rail") ||
      element.getAttribute("data-chrome") ||
      element.getAttribute("data-cle") ||
      element.tagName,
    l: Math.round(rect.left),
    t: Math.round(rect.top),
    sy: Math.round(window.pageYOffset),
  };
};

window.__pret = true;
