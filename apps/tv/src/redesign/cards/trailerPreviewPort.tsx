import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { INITIAL_PREVIEW_ZONE, reducePreviewZone, type PreviewWarmWant, type PreviewZoneEvent, type PreviewZoneState } from "@tentacle-tv/tv-core";
import type { HeroModel } from "../hero/HeroBanner";
import type { CardModel } from "./cardTypes";

/**
 * Le PORT de la ZONE D'APERÇU (tv-core `cards/previewZone.ts`) : l'aperçu se
 * joue toujours au même endroit, en haut de l'écran, et les cartes ne font
 * que DIRE leur focus. La vue ne sait ni d'où vient la vidéo ni comment elle
 * se lit : l'intégration fournit la zone (`redesignWiring/trailerPreview/`).
 *
 * - `PreviewZoneScope` : la portée d'UNE page (Accueil, Pour vous, une
 *   grille) — son propre magasin de focus. Une page couverte par une autre
 *   garde le sien : au retour, sa zone montre SA dernière carte.
 * - `useCardZoneFocus` : une carte focalisée le dit (sans rendu au repos ;
 *   `MediaCard` passe par `useCardPreviewFocus`, qui sait la page et la grille).
 * - `usePreviewZoneHero` : les boutons du héros de l'Accueil, de même.
 * - `PreviewZoneSlot` : où la page pose sa zone ; sans fournisseur (le banc),
 *   rien.
 * - `useCardPreviewWarm` : la page dit les cartes AUTOUR du focus — leur
 *   bande-annonce se prépare au serveur, leur fond se précharge.
 */

/** Le magasin de focus d'une page : l'état de la règle, et le modèle de la carte qui l'a eu en dernier. */
export interface PreviewZoneStore {
  getState(): PreviewZoneState;
  /** Le modèle de la dernière carte focalisée (tenu à jour tant qu'elle reste montée). */
  getCard(): CardModel | null;
  subscribe(listener: () => void): () => void;
  dispatch(event: PreviewZoneEvent, card?: CardModel): void;
  /** Le modèle de la carte a changé (une coche, une note) : sans évènement, la règle ne bouge pas. */
  refresh(card: CardModel): void;
}

export function createPreviewZoneStore(): PreviewZoneStore {
  let state = INITIAL_PREVIEW_ZONE;
  let card: CardModel | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    getState: () => state,
    getCard: () => card,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(event, model) {
      const next = reducePreviewZone(state, event);
      const nextCard = event.type === "focusCard" && model && next.subject?.kind === "card" ? model : card;
      if (next === state && nextCard === card) return;
      state = next;
      card = nextCard;
      emit();
    },
    refresh(model) {
      if (card?.id !== model.id || card === model) return;
      card = model;
      emit();
    },
  };
}

const ScopeContext = createContext<PreviewZoneStore | null>(null);

/** La portée d'une page : tout ce qu'elle enveloppe (sa zone, ses rangées) partage un magasin. */
export function PreviewZoneScope({ children }: { children: ReactNode }) {
  const store = useMemo(createPreviewZoneStore, []);
  return <ScopeContext.Provider value={store}>{children}</ScopeContext.Provider>;
}

/** Le magasin de la page, ou `null` hors d'une portée. */
export function usePreviewZoneStore(): PreviewZoneStore | null {
  return useContext(ScopeContext);
}

/** L'état de la règle, suivi (la zone). */
export function usePreviewZoneState(store: PreviewZoneStore): PreviewZoneState {
  return useSyncExternalStore(store.subscribe, store.getState);
}

/** Le modèle de la dernière carte focalisée, suivi (la zone). */
export function usePreviewZoneCard(store: PreviewZoneStore): CardModel | null {
  return useSyncExternalStore(store.subscribe, store.getCard);
}

/**
 * Une carte dit son focus à la zone de sa page : `active` — focalisée, et pas
 * dépassée par la page (le défilement accéléré d'une grille). Un modèle neuf
 * de la même carte (une coche) met la zone à jour sans relancer son aperçu.
 */
export function useCardZoneFocus(card: CardModel, active: boolean): void {
  const store = useContext(ScopeContext);
  const latest = useRef(card);
  latest.current = card;
  const id = card.id;
  useEffect(() => {
    if (!store || !active) return undefined;
    store.dispatch({ type: "focusCard", id, at: Date.now() }, latest.current);
    return () => store.dispatch({ type: "blurCard", id, at: Date.now() });
  }, [store, active, id]);
  useEffect(() => {
    if (store && active) store.refresh(card);
  }, [store, active, card]);
}

/** Les boutons du héros de l'Accueil disent leur focus : la zone remet le titre mis en avant. */
export function usePreviewZoneHero(active: boolean): void {
  const store = useContext(ScopeContext);
  useEffect(() => {
    if (!store || !active) return undefined;
    store.dispatch({ type: "focusHero", at: Date.now() });
    return () => store.dispatch({ type: "blurHero", at: Date.now() });
  }, [store, active]);
}

/** Ce que la page donne à sa zone. */
export interface PreviewZoneSlotProps {
  /** Le titre mis en avant (Accueil) : montré avant tout focus et au focus de ses boutons. */
  hero?: HeroModel | null;
  /** Ce que la zone montre avant tout focus de carte, sans héros (la première affiche d'une grille). */
  fallback?: CardModel | null;
}

/** La zone fournie par l'intégration : elle lit le magasin de la page (`usePreviewZoneStore`). */
export type PreviewZoneRenderer = ComponentType<PreviewZoneSlotProps>;

/**
 * La PRÉPARATION autour du focus : la page dit les cartes voisines (tv-core
 * `trailerPreviewWarmWindow`) ; l'intégration fait préparer leur bande-annonce
 * au serveur et précharge leur fond — leur focus n'aura rien à attendre. Une
 * grille REMPLACE ce qui attend encore (`replace`).
 */
export type CardPreviewWarm = (cards: readonly CardModel[], options?: PreviewWarmWant) => void;

const RendererContext = createContext<PreviewZoneRenderer | null>(null);
const WarmContext = createContext<CardPreviewWarm | null>(null);

/** Fournit la zone et la préparation à tout ce qu'il enveloppe (l'app). */
export function TrailerPreviewProvider({ zone, warm = null, children }: { zone: PreviewZoneRenderer; warm?: CardPreviewWarm | null; children: ReactNode }) {
  return (
    <RendererContext.Provider value={zone}>
      <WarmContext.Provider value={warm}>{children}</WarmContext.Provider>
    </RendererContext.Provider>
  );
}

/** Où la page pose sa zone (`BelowZonePage` `zone`). Sans fournisseur : rien. */
export function PreviewZoneSlot(props: PreviewZoneSlotProps) {
  const Zone = useContext(RendererContext);
  return Zone ? <Zone {...props} /> : null;
}

/** La préparation, ou `null` (sans fournisseur : rien ne se prépare). */
export function useCardPreviewWarm(): CardPreviewWarm | null {
  return useContext(WarmContext);
}
