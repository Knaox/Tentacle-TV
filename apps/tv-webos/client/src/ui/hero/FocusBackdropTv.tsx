import { useCallback, useEffect, useReducer, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { useFocusedItem } from "../cards/focusedItem";
import { useSearchOpen } from "../search/searchState";
import {
  INITIAL_SLOTS,
  arrived,
  settled,
  veiled,
  want,
  type BackdropSlot,
  type BackdropSlots,
  type SlotIndex,
} from "./backdropSlots";

/**
 * Le fond d'écran de la carte focalisée.
 *
 * **Aucun flou.** C'est le modèle d'Android TV et d'Apple TV, dont
 * `TVAmbientBackdrop` est la référence : le Backdrop de l'item, en pleine
 * résolution, cadré en `cover` sur tout l'écran, atténué par la couche et par
 * un dégradé vertical. On reconnaît le film, et le contenu posé dessus reste
 * lisible.
 *
 * Pour un épisode, on demande le Backdrop de la SÉRIE — mêmes raisons que sur
 * `apps/tv` : la vignette d'un épisode est un plan quelconque, celle de la
 * série est une affiche composée.
 *
 * **Deux emplacements fixes** (`backdropSlots.ts`) : l'ancienne image tient
 * l'écran jusqu'à ce que la nouvelle soit chargée ET décodée, puis les deux se
 * croisent. Aucun calque n'est créé ni détruit d'une carte à l'autre — c'est ce
 * qui faisait rastériser l'écran entier à chaque appui.
 *
 * L'opacité d'ensemble est posée sur la COUCHE, pas sur chaque image : deux
 * images à 0,55 superposées composent à 0,80, et le fondu croisé se verrait
 * comme un éclat au milieu du passage. Le voile, lui, reste dehors — c'est lui
 * qui rend le texte lisible, il n'a pas à s'atténuer avec l'image.
 *
 * Monté sur l'accueil et les bibliothèques seulement. Sur une fiche, la
 * bannière porte déjà son propre halo et les deux se disputeraient l'écran ;
 * pendant la lecture, rien ne doit être composé derrière l'image.
 */

const PATHS = ["/", "/library", "/watchlist", "/favorites", "/recommendations"];

function onBrowseScreen(path: string): boolean {
  if (path === "/") return true;
  for (const prefix of PATHS) {
    if (prefix !== "/" && path.startsWith(prefix)) return true;
  }
  return false;
}

type Action =
  | { kind: "want"; url: string | null }
  | { kind: "arrived"; index: SlotIndex; url: string }
  | { kind: "settled"; index: SlotIndex };

function reduce(state: BackdropSlots, action: Action): BackdropSlots {
  if (action.kind === "want") return want(state, action.url);
  if (action.kind === "arrived") return arrived(state, action.index, action.url);
  return settled(state, action.index);
}

export function FocusBackdropTv() {
  const { pathname } = useLocation();
  const item = useFocusedItem();
  const client = useJellyfinClient();
  // La recherche est opaque et couvre tout l'écran : le décor d'une carte
  // visée DEDANS ne serait vu par personne — ni téléchargé, ni composé.
  const searching = useSearchOpen();

  const browsing = onBrowseScreen(pathname) && !searching;
  const idImage = item && item.Type === "Episode" && item.SeriesId ? item.SeriesId : item?.Id;
  const url =
    browsing && idImage ? client.getImageUrl(idImage, "Backdrop", { width: 1920, quality: 70 }) : null;

  const [state, dispatch] = useReducer(reduce, INITIAL_SLOTS);
  useEffect(() => dispatch({ kind: "want", url }), [url]);

  const onArrived = useCallback((index: SlotIndex, address: string) => {
    dispatch({ kind: "arrived", index, url: address });
  }, []);
  const onSettled = useCallback((index: SlotIndex) => dispatch({ kind: "settled", index }), []);

  // Hors des écrans de parcours, et une fois la dernière image effacée, plus
  // rien n'est monté : ni calque, ni image décodée.
  const active = veiled(state);
  if (!browsing && !active) return null;

  return (
    <div className="fond-focus" data-active={active} aria-hidden>
      <span className="fond-focus-couche">
        <BackdropImage index={0} slot={state.slots[0]} onArrived={onArrived} onSettled={onSettled} />
        <BackdropImage index={1} slot={state.slots[1]} onArrived={onArrived} onSettled={onSettled} />
      </span>
      <span className="fond-focus-voile" />
    </div>
  );
}

/**
 * Un emplacement : un `<img>` qui ne se démonte pas, dont seule l'adresse change.
 *
 * L'image n'est déclarée arrivée qu'une fois DÉCODÉE (`decode()`) : le fondu
 * part alors sur des pixels prêts. Sans cela, Chromium rastérise d'abord
 * l'emplacement sans l'image — le temps de la décoder à part — puis une
 * seconde fois avec elle.
 *
 * Le cas du cache est tenu par l'effet : une image déjà `complete` au moment où
 * son adresse est posée peut avoir émis son `load` avant que React n'écoute —
 * le mode de panne classique de ce motif.
 */
function BackdropImage({
  index,
  slot,
  onArrived,
  onSettled,
}: {
  index: SlotIndex;
  slot: BackdropSlot;
  onArrived: (index: SlotIndex, url: string) => void;
  onSettled: (index: SlotIndex) => void;
}) {
  const image = useRef<HTMLImageElement>(null);
  const { url, ready } = slot;

  const announce = useCallback(() => {
    const element = image.current;
    if (!element || !url) return;
    const done = () => onArrived(index, url);
    if (typeof element.decode === "function") element.decode().then(done, done);
    else done();
  }, [index, url, onArrived]);

  useEffect(() => {
    const element = image.current;
    if (url && !ready && element?.complete && element.naturalWidth > 0) announce();
  }, [url, ready, announce]);

  return (
    <img
      ref={image}
      className="fond-focus-image"
      data-phase={slot.phase}
      src={url ?? undefined}
      alt=""
      onLoad={announce}
      onAnimationEnd={() => onSettled(index)}
    />
  );
}
