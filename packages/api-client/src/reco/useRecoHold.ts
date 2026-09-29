import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { releaseRecoCard } from "./recoRetirement";
import { holdRecoCard, isRecoDismissed, isRecoLeaving, subscribeRecoLeaving } from "./recoRetirementState";

/**
 * Tient des cartes de recommandation tant que `ids` n'est pas null — par clé
 * (« movie:603 ») ou par item Jellyfin. Au lâcher, un titre jugé (Ma liste,
 * cœur, vu, note) sort des recommandations (cf. recoRetirement.ts).
 */
export function useRecoHold(ids: readonly string[] | null): void {
  const qc = useQueryClient();
  const signature = ids && ids.length > 0 ? ids.join("\n") : null;
  useEffect(() => {
    if (signature === null) return;
    const held = signature.split("\n");
    for (const id of held) holdRecoCard(id);
    return () => {
      for (const id of held) releaseRecoCard(qc, id);
    };
  }, [signature, qc]);
}

/**
 * Une carte tenue le temps que sa feuille d'actions est ouverte : à brancher
 * dans la portée qui l'ouvre, avec l'identité de la carte visée (null :
 * aucune feuille). `lingerMs` : une feuille qui glisse ENCORE après sa
 * fermeture tient la carte le temps de sa sortie — le titre jugé s'efface
 * une fois la feuille partie, pas dessous.
 */
export function useRecoCardHold(id: string | null, lingerMs = 0): void {
  const [previous, setPrevious] = useState(id);
  const [lingering, setLingering] = useState<string | null>(null);
  // État dérivé, posé pendant le rendu : le rendu qui ferme la feuille tient
  // DÉJÀ la carte par `lingering` — aucun lâcher intermédiaire ne part.
  if (id !== previous) {
    setPrevious(id);
    setLingering(!id && previous && lingerMs > 0 ? previous : null);
  }
  useEffect(() => {
    if (!lingering) return;
    const timer = setTimeout(() => setLingering(null), lingerMs);
    return () => clearTimeout(timer);
  }, [lingering, lingerMs]);
  const held = id ?? lingering;
  useRecoHold(held ? [held] : null);
}

/** Pur : ce qu'une rangée tenue montre — sa photographie, moins les titres écartés. */
export function heldRecoView<T extends { key: string }>(
  items: readonly T[],
  frozen: readonly T[] | null,
  held: boolean
): readonly T[] {
  if (!held) return items;
  return (frozen ?? items).filter((item) => !isRecoDismissed(item.key));
}

/**
 * Les cartes d'une rangée (ou les diapositives d'un héros) SURVOLÉE : toutes
 * tenues, et figées telles qu'au premier instant du survol — rien ne bouge
 * sous le curseur, ni un titre jugé, ni ce qu'une page resservie retirerait
 * ou ajouterait. Seul « Ne plus me proposer » passe : l'utilisateur l'a
 * demandé, la carte part tout de suite. Le survol fini, la rangée suit ses
 * données, sans les titres jugés.
 */
export function useHeldRecoItems<T extends { key: string }>(items: readonly T[], held: boolean): readonly T[] {
  const [frozen, setFrozen] = useState<readonly T[] | null>(null);
  // État dérivé des props, posé pendant le rendu (motif documenté de React) :
  // la photographie est celle du rendu où le survol commence.
  if (held && frozen === null) setFrozen(items);
  else if (!held && frozen !== null) setFrozen(null);
  const source = held ? (frozen ?? items) : items;
  useRecoHold(held ? source.map((item) => item.key) : null);
  return useMemo(() => heldRecoView(items, frozen, held), [held, frozen, items]);
}

/** La carte de ce titre s'efface-t-elle, jugée et lâchée, avant son retrait ? */
export function useIsRecoLeaving(key: string): boolean {
  return useSyncExternalStore(subscribeRecoLeaving, () => isRecoLeaving(key), () => false);
}
