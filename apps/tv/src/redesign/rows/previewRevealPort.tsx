import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode, type RefObject } from "react";
import type { ScrollView } from "react-native";

/**
 * La PAGE qui montre une grande carte d'aperçu (`CardPreviewTile`) : la carte
 * grandit vers le bas, et la page, qui l'avait montrée à sa taille de repos
 * en y entrant (`FocusSection reveal`), ne le sait pas. La rangée dit ce qui
 * dépasse (tv-core `trailerPreviewRevealOffset`) ; la page défile d'autant.
 *
 * Sans fournisseur (une page qui ne défile pas, le banc), rien : la rangée
 * montre sa grande carte entière en largeur seulement.
 */
export interface PreviewReveal {
  /** Défile la page vers le bas de `offset` points, en un mouvement. */
  scrollBy(offset: number): void;
}

const RevealContext = createContext<PreviewReveal | null>(null);

export function PreviewRevealProvider({ reveal, children }: { reveal: PreviewReveal; children: ReactNode }) {
  return <RevealContext.Provider value={reveal}>{children}</RevealContext.Provider>;
}

export function usePreviewReveal(): PreviewReveal | null {
  return useContext(RevealContext);
}

/**
 * La moitié « page » : le défilement vertical de sa ScrollView, relevé sans
 * rendu par `track` (à appeler depuis son `onScroll`), et le port qui défile.
 */
export function usePagePreviewReveal(scrollRef: RefObject<ScrollView | null>): { reveal: PreviewReveal; track: (y: number) => void } {
  const offset = useRef(0);
  const track = useCallback((y: number) => {
    offset.current = y;
  }, []);
  const reveal = useMemo<PreviewReveal>(
    () => ({
      scrollBy(by) {
        scrollRef.current?.scrollTo({ x: 0, y: offset.current + by, animated: true });
      },
    }),
    [scrollRef],
  );
  return { reveal, track };
}
