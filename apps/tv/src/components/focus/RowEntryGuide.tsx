import { forwardRef, useCallback, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { TVFocusGuideView, type NativeScrollEvent, type NativeSyntheticEvent, type View } from "react-native";
import { Spacing } from "../../theme/colors";

type EntrySetter = (node: View) => void;

/**
 * Le guide d'entrée d'une rangée : quand le focus y ARRIVE d'ailleurs — d'une
 * rangée voisine, de la bannière —, il atterrit sur la première carte visible.
 *
 * Sans lui, la géométrie visait la carte située sous le point de départ.
 * Depuis le bout d'une rangée, c'était la septième de la suivante, que sa
 * propre rangée faisait aussitôt défiler pour la ramener à gauche : on
 * changeait de rangée et c'était celle d'en dessous qui partait de côté. La
 * LG applique la même règle à ses pistes.
 *
 * « Première VISIBLE » et non « première » : une rangée jamais parcourue
 * montre sa première carte, donc on y entre par elle ; une rangée qu'on a
 * fait défiler garde sa position, et l'on retrouve la carte qu'on y avait
 * laissée — elle est épinglée à gauche.
 *
 * La destination vit dans l'ÉTAT de ce petit composant, et non dans celui de
 * la rangée : la changer ne redessine que le guide, pas la liste ni ses
 * cartes. Elle passe par la prop `destinations` et jamais par la commande
 * impérative seule : sur tvOS, un guide sans cette prop n'est pas
 * « sélectionnable », et un guide non sélectionnable coupe l'interaction de
 * tout son contenu — les cartes deviendraient inatteignables.
 */
export const RowEntryGuide = forwardRef<EntrySetter, { children: ReactNode }>(function RowEntryGuide(
  { children },
  ref,
) {
  const [entry, setEntry] = useState<View | null>(null);
  useImperativeHandle(ref, () => (node: View) => setEntry((prev) => (prev === node ? prev : node)), []);

  return (
    // Pas de trapFocusLeft : GAUCHE depuis la 1re carte doit atteindre le rail.
    <TVFocusGuideView trapFocusRight destinations={entry ? [entry] : undefined}>
      {children}
    </TVFocusGuideView>
  );
});

/**
 * Ce que la rangée fournit au guide : l'annuaire des cartes montées, et la
 * position de défilement d'où se déduit la première carte visible.
 */
export function useRowEntry({ itemWidth, gap, count }: { itemWidth: number; gap: number; count: number }) {
  const guideRef = useRef<EntrySetter>(null);
  const cells = useRef(new Map<number, View>());
  const scrollX = useRef(0);
  const geometry = useRef({ stride: itemWidth + gap, count });
  geometry.current = { stride: itemWidth + gap, count };

  const aim = useCallback(() => {
    const { stride, count: total } = geometry.current;
    if (total === 0) return;
    // La carte i commence à rowGutter + i × pas dans le contenu ; elle est
    // entièrement visible dès que ce bord dépasse le défilement.
    const leftmost = Math.ceil((scrollX.current - Spacing.rowGutter) / stride - 0.01);
    const index = Math.min(Math.max(0, leftmost), total - 1);
    const node = cells.current.get(index);
    if (node) guideRef.current?.(node);
  }, []);

  const onNode = useCallback((index: number, node: View | null) => {
    if (node) cells.current.set(index, node);
    else cells.current.delete(index);
    aim();
  }, [aim]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.current = e.nativeEvent.contentOffset.x;
    aim();
  }, [aim]);

  return { guideRef, onNode, onScroll };
}
