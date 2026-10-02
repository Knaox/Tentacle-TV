import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import type { QualityBadge } from "@tentacle-tv/shared";
import type { CardQuality } from "./cardTypes";

/**
 * Le PORT de la qualité des titres : ce que l'intégration fournit pour qu'une
 * carte focalisée lise la qualité d'un titre que sa liste ne porte pas (une
 * grille de bibliothèque n'a pas les flux — `CardQuality.probe`). La vue ne
 * sait ni d'où ni comment : elle dit seulement QUAND (son focus a tenu), et
 * rend ce qui est connu. Sans fournisseur (le banc), rien ne se lit : seule la
 * qualité déjà dans le modèle se montre.
 */
export interface QualityBadgeSource {
  /** Ce qui est déjà connu du titre (lu plus tôt, fiche ouverte), sans rien demander. */
  peek(id: string): readonly QualityBadge[] | undefined;
  /** Le focus a tenu : lire le titre, s'il n'est ni connu ni déjà en route. */
  request(id: string): void;
  /** Être prévenu quand le titre devient connu ; rend de quoi se désabonner. */
  subscribe(id: string, onChange: () => void): () => void;
}

const SourceContext = createContext<QualityBadgeSource | null>(null);

/** Fournit la source à tout ce qu'il enveloppe ; `source` doit être stable. */
export function QualityBadgeProvider({ source, children }: { source: QualityBadgeSource; children: ReactNode }) {
  return <SourceContext.Provider value={source}>{children}</SourceContext.Provider>;
}

const bump = (n: number) => n + 1;

/**
 * Les badges d'une carte : ceux de son modèle, ou — titre à lire — ceux que
 * la source connaît, demandés quand le focus TIENT (`held`) : un focus qui
 * balaie une rangée ne demande rien. `null` : rien à montrer (pas encore).
 */
export function useQualityBadges(quality: CardQuality | undefined, held: boolean): readonly QualityBadge[] | null {
  const source = useContext(SourceContext);
  const probe = quality && "probe" in quality ? quality.probe : undefined;
  const [, changed] = useReducer(bump, 0);
  useEffect(() => {
    if (!probe || !source || !held) return undefined;
    const unsubscribe = source.subscribe(probe, changed);
    source.request(probe);
    return unsubscribe;
  }, [probe, source, held]);
  if (!quality) return null;
  if ("badges" in quality) return quality.badges;
  return (probe && source?.peek(probe)) || null;
}
