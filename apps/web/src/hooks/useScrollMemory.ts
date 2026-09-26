import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const scrollPositions = new Map<string, number>();

/**
 * Pages qui s'ouvrent TOUJOURS en haut, quelle que soit la position mémorisée.
 *
 * La mémoire de défilement a du sens sur une surface qu'on PARCOURT en largeur —
 * une bibliothèque, les favoris : on y revient pour reprendre là où on butinait,
 * et retomber en haut fait perdre le fil. Elle n'en a aucun sur une FICHE : on y
 * arrive pour un titre précis, et toute la page est construite autour de sa
 * bannière et de son affiche. Y revenir à mi-hauteur, sur la liste d'épisodes,
 * oblige à remonter pour comprendre où l'on est — d'autant plus déroutant que
 * l'ouverture est désormais animée depuis le visuel cliqué : l'animation se
 * jouait hors écran, au-dessus de la position restaurée.
 *
 * L'ACCUEIL en fait désormais partie. Ce n'est pas une surface de parcours mais
 * la page d'où l'on part : sa bannière et « Reprendre la lecture » sont tout en
 * haut, et c'est ce qu'on vient y chercher. Y revenir au milieu des rangées, sous
 * une bannière qui tourne hors écran, donne l'impression d'avoir raté la page.
 */
const ALWAYS_TOP = [/^\/$/, /^\/media\//, /^\/shared\//];

const opensAtTop = (pathname: string): boolean =>
  ALWAYS_TOP.some((pattern) => pattern.test(pathname));

/**
 * Rend à chaque écran la position où on l'a quitté.
 *
 * **La position se relève pendant qu'on est sur l'écran, jamais en le
 * quittant.** On la lisait dans l'effet qui suit le changement d'adresse, donc
 * une fois l'écran suivant monté à sa place — et tout ce qui défilait entre les
 * deux s'écrivait au compte de l'écran quitté. Le document de l'écran suivant,
 * plus court, rabotait le défilement : mesuré sur la dalle, une bibliothèque
 * quittée à 3660 px était mémorisée à 108, tout ce que la fiche encore en
 * chargement laisse défiler. S'y ajoutaient le virtualiseur qui se monte en
 * écrivant sa propre position, et le moteur de focus du téléviseur qui recadre
 * l'écran sortant. Au retour, la carte quittée était trop loin de la position
 * rendue pour être montée : le focus retombait sur la première affiche.
 *
 * On note donc la position à chaque défilement, TANT QUE l'adresse du
 * navigateur désigne l'écran : elle change à l'instant même de la navigation,
 * avant que quoi que ce soit ne soit démonté, et ce qui défile ensuite
 * appartient déjà à l'écran suivant.
 */
export function useScrollMemory() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (opensAtTop(pathname)) {
      window.scrollTo(0, 0);
      return;
    }

    window.scrollTo(0, scrollPositions.get(pathname) ?? 0);

    // L'adresse complète, préfixe du routeur compris (`/tv` sur le
    // téléviseur) : c'est elle que la navigation change, et `pathname` ne la
    // porte pas.
    const address = window.location.pathname;
    const record = () => {
      if (window.location.pathname !== address) return;
      scrollPositions.set(pathname, window.scrollY);
    };
    window.addEventListener("scroll", record, { passive: true });
    return () => window.removeEventListener("scroll", record);
  }, [pathname]);
}
