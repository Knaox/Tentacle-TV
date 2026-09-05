import { useCallback, useEffect, useState } from "react";
import {
  EPISODE_VW,
  EPISODE_WIDTH,
  POSTER_VW,
  POSTER_WIDTH,
  idealCardWidth,
} from "../cards/cardSizes";
import { useCardSize } from "../../contexts/CardDensityContext";

/**
 * Largeur de carte calée sur la rangée : un nombre ENTIER de cartes remplit
 * exactement la zone de contenu, à la gouttière près.
 *
 * Le `clamp(base, Xvw, lg)` d'origine donnait une largeur qui n'avait aucune
 * raison de diviser la rangée. Il restait donc systématiquement un morceau de
 * carte au bord droit — sur une rangée de 1320 px avec des cartes de 346 px au
 * pas de 358, exactement 99 px, et ce reste ne dépend pas de la taille de la
 * fenêtre : c'est le reste d'une division, il ne disparaît jamais. D'où une
 * carte tronquée en permanence, qui déborde visuellement du carrousel.
 *
 * En repartant de la largeur idéale et en arrondissant au nombre de cartes le
 * plus proche, l'écart se répartit sur toutes les cartes — quelques pixels
 * chacune, invisibles — au lieu de s'accumuler sur la dernière. Effet de bord
 * appréciable : plus aucune carte n'est rognée, donc plus aucune n'est privée
 * de son panneau d'aperçu, et l'accroche au défilement tombe toujours juste.
 *
 * `null` quand une seule carte tiendrait (mobile) : on garde alors le `clamp`,
 * dont le débord de la carte suivante est justement l'indice qu'il y a une
 * suite à faire défiler. Remplir toute la largeur avec une seule carte
 * effacerait cet indice.
 */
export function useRowCardWidth(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  variant: "poster" | "episode",
): number | null {
  const [width, setWidth] = useState<number | null>(null);
  // Densité choisie dans Personnalisation — lue AU point de mesure, pour que
  // ni les rangées ni les cartes n'aient à transporter la prop.
  const size = useCardSize();

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const content =
      el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    // Gouttière lue sur l'élément plutôt qu'écrite en dur : elle vit dans la
    // classe `gap-3` de la rangée, un seul endroit fait autorité.
    const gap = parseFloat(cs.columnGap) || 0;
    if (content <= 0) return;

    const ideal =
      variant === "episode"
        ? idealCardWidth(EPISODE_WIDTH[size], EPISODE_VW, window.innerWidth)
        : idealCardWidth(POSTER_WIDTH[size], POSTER_VW, window.innerWidth);

    const count = Math.round((content + gap) / (ideal + gap));
    if (count < 2) {
      setWidth(null);
      return;
    }
    setWidth((content - gap * (count - 1)) / count);
  }, [scrollRef, variant, size]);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, scrollRef]);

  return width;
}
