/**
 * Le voile posé sur le chrome de l'hôte pendant qu'un greffon affiche une
 * surface modale — sa fiche média, une feuille de filtres.
 *
 * Le greffon est dans une iframe sandboxée : il ne peut pas toucher ce DOM, il
 * le DEMANDE (`__tentacle_bridge.setOverlay` → `OVERLAY_OPEN` / `OVERLAY_CLOSE`,
 * cf. `PluginIframe`). D'où ce module : ces styles sont écrits impérativement,
 * hors de React, sur des éléments que React ne remontera pas — personne ne les
 * remet à zéro tout seul, et rien ne les efface au rechargement d'une route.
 *
 * C'est précisément ce qui manquait. La levée du voile partait du nettoyage
 * d'un effet CÔTÉ GREFFON, qui ne s'exécute jamais quand la navigation détruit
 * l'iframe : ouvrir une fiche de greffon puis cliquer « Regarder » laissait la
 * barre du haut floue, assombrie et INERTE (`pointer-events: none`) sur la page
 * d'arrivée, et pour tout le reste de la session. Un seul endroit écrit ces
 * styles, donc un seul endroit sait les retirer.
 */

const SELECTOR = "[data-host-chrome]";

export function setHostChromeVeil(active: boolean): void {
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    if (active) {
      el.style.filter = "blur(4px) brightness(0.5)";
      el.style.pointerEvents = "none";
      // Posée à l'ouverture seulement, et JAMAIS retirée : c'est elle qui rend
      // sa netteté au chrome en fondu plutôt que d'un coup.
      el.style.transition = "filter 300ms ease";
    } else {
      el.style.filter = "";
      el.style.pointerEvents = "";
    }
  });
}
