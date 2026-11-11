import { useContext, useMemo, type ContextType } from "react";
import { PresenceContext } from "framer-motion";

type PresenceProps = NonNullable<ContextType<typeof PresenceContext>>;

/** Rien ne s'inscrit : l'inscription rend tout de suite de quoi se désinscrire. */
const noRegistration = () => () => undefined;

/**
 * La présence que voit le CONTENU d'une page, sous l'enveloppe `RouteExit`.
 *
 * Une page qui sort ne doit attendre que son enveloppe : c'est elle seule qui
 * s'efface (l'opacité de la page entière). Ce que la page contient de `motion`
 * n'a pas à s'inscrire auprès de sa sortie — et ne le doit surtout pas :
 *
 * `usePresence` de framer-motion 11.18 (celui de `MeasureLayout`, donc de tout
 * élément `layout` / `layoutId`) s'inscrit sans jamais se désinscrire. Un
 * élément de ce genre démonté pendant la vie de la page laisse une inscription
 * orpheline, jamais close : l'indicateur de l'onglet courant (`NavTab`,
 * `layoutId="nav-active"`) en laisse une à chaque changement d'onglet. La sortie
 * de la coquille ne finissait alors JAMAIS — page gardée, épinglée, invisible —
 * et `AnimatePresence` ne retire une page sortie que quand TOUTES ont fini : le
 * lecteur quitté restait monté et jouait en fond, sans arrêt dit à Jellyfin,
 * jusqu'au retour dans la coquille (retour de Damien, 2026-10-12).
 *
 * Le contenu voit donc une page toujours présente, au registre muet ; seul
 * `initial` est repris, pour que le premier rendu de l'application reste sans
 * animation d'entrée (`AnimatePresence initial={false}`). Un `AnimatePresence`
 * imbriqué (menus, cartes, avis…) garde sa présence à lui : rien n'y change.
 */
export function pagePresence(id: string, initial: PresenceProps["initial"]): PresenceProps {
  return { id, isPresent: true, register: noRegistration, initial };
}

/**
 * `pagePresence` d'après la présence de l'enveloppe. Mémoïsée sur ce qu'elle
 * reprend : le contexte de `PresenceChild` change d'identité à chaque rendu, et
 * chaque identité neuve re-rendrait tout le `motion` de la page.
 *
 * `blockEntrances` : la page REMPLACE une page affichée et se prépare cachée — son contenu
 * rend son état final d'emblée (`initial: false`, comme le premier rendu de l'application).
 * La transition de page est son entrée : une cascade de texte jouée dessous, invisible,
 * n'aurait plus qu'à finir au mauvais moment. Ce qui se monte APRÈS s'anime comme toujours.
 */
export function usePagePresence(blockEntrances = false): ContextType<typeof PresenceContext> {
  const outer = useContext(PresenceContext);
  const id = outer === null ? null : outer.id;
  const initial = blockEntrances ? false : outer?.initial;
  return useMemo(() => (id === null ? null : pagePresence(id, initial)), [id, initial]);
}
