import { useCallback, useState, type ReactNode } from "react";
import { useRecoCardHold } from "@tentacle-tv/api-client";
import { MediaActionSheet } from "@/components/MediaActionSheet";
import { RecoActionSheet } from "@/components/reco/RecoActionSheet";
import { CardSheetContext, type CardSheetNavigation } from "./cardSheetContext";
import type { CardSheetTarget } from "./cardSheetTarget";

interface Props {
  children: ReactNode;
  /** Navigation propre à la portée (la recherche, modale) ; empiler sinon. */
  navigation?: CardSheetNavigation;
}

/**
 * LA feuille d'appui long d'une portée, et l'ouvreur que ses cartes lisent
 * (`useCardSheetOpener`). Une portée à la racine de l'app couvre tous les
 * écrans empilés ; la recherche, présentée en modale, a la sienne — une
 * modale React Native se présente depuis le contrôleur de sa vue, et celui
 * de la racine est déjà occupé à présenter la recherche.
 *
 * Toute carte de la bibliothèque (`MobileMediaCard`, `RecoCard`) s'y branche
 * d'elle-même : pas d'appui long à faire descendre de rangée en rangée. Une
 * recommandation HORS bibliothèque n'a pas d'item : elle ouvre la feuille des
 * cartes Vigie (« Demander », Ma liste à l'arrivée), qui lui revient.
 */
export function CardSheetScope({ children, navigation }: Props) {
  const [target, setTarget] = useState<CardSheetTarget | null>(null);
  const open = useCallback((next: CardSheetTarget) => setTarget(next), []);
  const close = useCallback(() => setTarget(null), []);
  // Feuille ouverte = carte tenue : un titre jugé quitte « Pour vous » à la fermeture.
  useRecoCardHold(target?.reco?.key ?? target?.item?.Id ?? null);
  const external = target?.variant === "reco" && target.item === null ? (target.reco ?? null) : null;
  return (
    <CardSheetContext.Provider value={open}>
      {children}
      <MediaActionSheet target={external ? null : target} onClose={close} navigation={navigation} />
      <RecoActionSheet item={external} onClose={close} />
    </CardSheetContext.Provider>
  );
}
