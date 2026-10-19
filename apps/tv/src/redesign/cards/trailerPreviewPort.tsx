import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { INITIAL_PREVIEW_ZONE, reducePreviewZone, type PreviewWarmWant, type PreviewZoneEvent, type PreviewZoneState } from "@tentacle-tv/tv-core";
import type { HeroModel } from "../hero/heroTypes";
import type { PreviewZoneModel } from "../previewZone/zoneModel";
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

/**
 * Ce que la SCÈNE d'une page à cartes qui s'ouvrent dit à la page (la zone l'écrit) :
 * les détails du titre focalisé (sous sa carte ouverte), et le titre dont la vidéo se
 * montre (`watching` : l'id de sa carte, ou « hero ») — sa carte devient transparente,
 * la vidéo posée derrière elle se voit.
 */
export interface PreviewStageInfo {
  model: PreviewZoneModel | null;
  watching: string | null;
}

/** Le magasin de focus d'une page : l'état de la règle, et le modèle de la carte qui l'a eu en dernier. */
export interface PreviewZoneStore {
  getState(): PreviewZoneState;
  /** Le modèle de la dernière carte focalisée (tenu à jour tant qu'elle reste montée). */
  getCard(): CardModel | null;
  getInfo(): PreviewStageInfo;
  setInfo(info: PreviewStageInfo): void;
  subscribe(listener: () => void): () => void;
  dispatch(event: PreviewZoneEvent, card?: CardModel): void;
  /** Le modèle de la carte a changé (une coche, une note) : sans évènement, la règle ne bouge pas. */
  refresh(card: CardModel): void;
}

const NO_INFO: PreviewStageInfo = { model: null, watching: null };

export function createPreviewZoneStore(): PreviewZoneStore {
  let state = INITIAL_PREVIEW_ZONE;
  let card: CardModel | null = null;
  let info = NO_INFO;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    getState: () => state,
    getCard: () => card,
    getInfo: () => info,
    setInfo(next) {
      if (next.model === info.model && next.watching === info.watching) return;
      info = next;
      emit();
    },
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
      if (card?.id !== model.id || card === model || sameZoneCard(card, model)) return;
      card = model;
      emit();
    },
  };
}

/**
 * Ce que la zone montre d'une carte n'a pas changé : un modèle neuf de la même
 * carte (une rangée qui se redessine) ne la redessine pas. Les listes gardent
 * déjà l'objet d'une carte inchangée (`stableCards`, `sameCard`) ; cette garde
 * vaut pour celles qui ne le font pas.
 */
function sameZoneCard(a: CardModel, b: CardModel): boolean {
  return (
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.focusNote === b.focusNote &&
    a.landscapeUri === b.landscapeUri &&
    a.posterUri === b.posterUri &&
    a.logoUri === b.logoUri &&
    a.absent === b.absent &&
    a.billboard?.backdropUri === b.billboard?.backdropUri &&
    a.billboard?.logoUri === b.billboard?.logoUri &&
    a.trailer === b.trailer
  );
}

const ScopeContext = createContext<PreviewZoneStore | null>(null);
/** Le contexte du magasin de la page (lecture sans abonnement : une carte s’y abonne seule, par sélecteur). */
export const previewStoreContext = ScopeContext;

/**
 * L'opacité de la SCÈNE de la page (0 → 1), sur le fil d'interface : la scène l'écrit, ses
 * surfaces (carte ouverte, bannière) la lisent dans leur opacité. Une coupure de la scène
 * rend donc leur face À LA MÊME IMAGE, par construction — deux valeurs animées écrites dans
 * le même rendu ne s'appliquaient pas toujours ensemble (un trou noir d'une image, Android TV).
 */
const StageShownContext = createContext<SharedValue<number> | null>(null);

/** La portée d'une page : tout ce qu'elle enveloppe (sa zone, ses rangées) partage un magasin. */
export function PreviewZoneScope({ children }: { children: ReactNode }) {
  const store = useMemo(createPreviewZoneStore, []);
  const stageShown = useSharedValue(0);
  return (
    <ScopeContext.Provider value={store}>
      <StageShownContext.Provider value={stageShown}>{children}</StageShownContext.Provider>
    </ScopeContext.Provider>
  );
}

/** L'opacité de la scène de la page ; hors d'une portée, `fallback` (une valeur à soi). */
export function useStageShown(fallback: number): SharedValue<number> {
  const local = useSharedValue(fallback);
  return useContext(StageShownContext) ?? local;
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

const NO_STORE_SUBSCRIBE = () => () => undefined;

/** Les détails et la vidéo de la scène de la page, suivis (les cartes qui s'ouvrent, la bannière). */
export function usePreviewStageInfo(): PreviewStageInfo {
  const store = useContext(ScopeContext);
  return useSyncExternalStore(store ? store.subscribe : NO_STORE_SUBSCRIBE, store ? store.getInfo : () => NO_INFO);
}

/** La clé de la bannière sur la scène et dans `watching` (une carte y a son identifiant). */
export const HERO_STAGE_KEY = "hero";

/**
 * Une surface de la scène (une carte par son id, la bannière par `HERO_STAGE_KEY`) :
 * sa vidéo se montre (`watching`), elle est le sujet focalisé sans vidéo (`subject`),
 * ou le focus l'a quittée (`away`). Lu dans le MÊME rendu que la scène — le même
 * magasin, la même émission : la face d'une surface quittée revient à l'image même
 * où la scène se coupe (tv-core `previewStageCut`), jamais une image plus tard.
 */
export type StageSurface = "watching" | "subject" | "away";

export function useStageSurface(key: string): StageSurface {
  const store = useContext(ScopeContext);
  return useSyncExternalStore(store ? store.subscribe : NO_STORE_SUBSCRIBE, () => {
    if (!store) return "away";
    const { subject, focused } = store.getState();
    const mine = focused && subject !== null && (key === HERO_STAGE_KEY ? subject.kind === "hero" : subject.kind === "card" && subject.id === key);
    if (!mine) return "away";
    return store.getInfo().watching === key ? "watching" : "subject";
  });
}

/** Le sujet focalisé de la page (une carte, la bannière), suivi : `null` sans focus ou hors d'une portée. */
export function usePreviewSubject(): PreviewZoneState["subject"] {
  const store = useContext(ScopeContext);
  return useSyncExternalStore(store ? store.subscribe : NO_STORE_SUBSCRIBE, () => (store ? store.getState().subject : null));
}

/**
 * Une carte dit son focus à la zone de sa page : `active` — focalisée, et pas
 * dépassée par la page (le défilement accéléré d'une grille). Un modèle neuf
 * de la même carte (une coche) met la zone à jour sans relancer son aperçu.
 *
 * Le focus est DATÉ AU RENDU qui le constate (le premier où `active` vaut
 * vrai, juste après l'évènement natif), pas dans l'effet qui suit le commit :
 * la machine de l'aperçu part de l'arrivée du focus.
 *
 * Une cellule RECYCLÉE (clé de place d'une ligne de grille) qui reçoit une
 * autre carte en gardant le focus : c'est bien la carte focalisée qui change
 * sous la télécommande — la zone la suit.
 */
export function useCardZoneFocus(card: CardModel, active: boolean): void {
  const store = useContext(ScopeContext);
  const latest = useRef(card);
  latest.current = card;
  const id = card.id;
  const focusedAt = useRef<{ id: string; at: number } | null>(null);
  if (!active) focusedAt.current = null;
  else if (focusedAt.current?.id !== id) focusedAt.current = { id, at: Date.now() };
  useEffect(() => {
    if (!store || !active) return undefined;
    store.dispatch({ type: "focusCard", id, at: focusedAt.current?.at ?? Date.now() }, latest.current);
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

/** Un rectangle de la scène (1920 × 1080). */
export interface StageRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  /** La largeur de la vidéo, calée à droite (tv-core `OPEN_HERO_WATCH`) ; absente : elle remplit. */
  mediaWidth?: number;
}

/** Ce que la page donne à sa zone. */
export interface PreviewZoneSlotProps {
  /** Le titre mis en avant (Accueil) : montré avant tout focus et au focus de ses boutons. */
  hero?: HeroModel | null;
  /** Ce que la zone montre avant tout focus de carte, sans héros (la première affiche d'une grille). */
  fallback?: CardModel | null;
  /**
   * Une page à cartes qui S'OUVRENT (Accueil, « Pour vous », listes, bibliothèques) :
   * pas de zone fixe — la vidéo se pose DERRIÈRE la page, au rectangle de la carte
   * ouverte (toujours le même) ou de la bannière, et rien ne recouvre une cible.
   */
  stage?: { card: StageRect; hero?: StageRect };
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
