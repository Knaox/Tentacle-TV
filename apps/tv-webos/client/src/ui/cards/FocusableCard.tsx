import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { MediaItem } from "@tentacle-tv/shared";
import { captureDetailOrigin } from "@/components/detail/detailTransition";
import { CardMetaOverlay } from "@/components/media/CardMetaOverlay";
import { createLongPress } from "../../focus/longPress";
import { releaseItem, aimItem } from "./focusedItem";

/**
 * Rend une carte du client web atteignable à la télécommande.
 *
 * Elle **enveloppe** la carte au lieu de la remplacer : `PosterCard` et
 * `EpisodeCard` restent ceux d'`apps/web`, avec leur résolution d'affiche,
 * leur libellé de saison, leur cascade d'entrée et leur capture d'origine pour
 * la transition de la fiche. Les forker aurait coûté quatre cents lignes de
 * logique qui auraient divergé en silence.
 *
 * Ce que l'enveloppe apporte, et que la carte ne pouvait pas donner :
 *
 * - **la focusabilité** — les cartes du web sont des `<div onClick>` sans
 *   `tabIndex` ni `role`, donc invisibles pour le moteur de navigation ;
 * - **l'appui court et le maintien**, qui ont besoin d'un élément qui reçoive
 *   les touches ;
 * - **un ancêtre stylable au focus**, ce qui permet d'écrire le bloc méta sans
 *   `:has()` — refusé par la garde de compatibilité ;
 * - **l'épinglage dans le fenêtrage**, sans lequel la carte active serait
 *   démontée sous le focus au premier balayage rapide ;
 * - **les métadonnées au focus** — 4K, HDR, Dolby Vision, langues.
 *
 * Ce dernier point mérite son explication. `CardMetaOverlay` existe déjà et
 * fait exactement ce qu'il faut, mais les cartes du web ne le montent qu'au
 * SURVOL : sur une dalle, `hovered` ne passe jamais à vrai, et la feuille
 * téléviseur achève ce qui resterait. On le monte donc ici, et **uniquement
 * pendant que la carte a le focus** — c'est la première règle de coût du
 * projet : ce qui n'est pas affiché ne doit rien consommer. Une rangée de
 * quarante cartes ne compose qu'un seul bloc de pastilles à la fois.
 *
 * Aucune requête de plus : `MediaSources` est déjà demandé par tous les hooks
 * d'accueil et de catalogue, précisément pour ces pastilles.
 */

interface FocusableCardProps {
  /** Index dans la LISTE, pas dans la fenêtre — c'est ce qu'attend l'épinglage. */
  index: number;
  /** Largeur calculée par la rangée ; l'enveloppe et la carte la partagent. */
  width: number | null;
  /** Identifiant de l'item, pour la navigation du maintien. */
  itemId: string;
  /** L'item complet, pour les pastilles montées au focus. */
  item?: MediaItem;
  /** Épinglage du fenêtrage : `null` au blur. */
  onActiveIndex: (index: number | null) => void;
  children: ReactNode;
}

export function FocusableCard({
  index,
  width,
  itemId,
  item,
  onActiveIndex,
  children,
}: FocusableCardProps) {
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [focused, setFocused] = useState(false);

  /**
   * L'appui court rejoue un vrai clic sur la carte enveloppée.
   *
   * `HTMLElement.click()` existe depuis toujours et dispatche un `MouseEvent`
   * que le système d'événements de React récupère sur le `<div onClick>` de la
   * carte. On hérite ainsi de tout ce que la carte fait déjà — capture
   * d'origine pour la transition, garde du menu contextuel, résolution de
   * l'épisode à reprendre — sans en dupliquer une ligne.
   */
  const shortAction = useCallback(() => {
    const card = root.current?.firstElementChild;
    if (card instanceof HTMLElement) card.click();
  }, []);

  /**
   * Le maintien ouvre la fiche, avec l'origine de la transition.
   *
   * `[data-card-visual]` est déjà l'attribut par lequel la carte se désigne à
   * ses propres mesures : on s'y raccroche plutôt que d'ajouter un marqueur au
   * composant partagé.
   */
  const longAction = useCallback(() => {
    const visual = root.current?.querySelector<HTMLElement>("[data-card-visual]");
    if (visual) {
      const radius = Number.parseFloat(window.getComputedStyle(visual).borderTopLeftRadius) || 0;
      const image = visual.querySelector("img");
      captureDetailOrigin(visual, itemId, image?.currentSrc || image?.src || "", radius);
    }
    navigate(`/media/${itemId}`);
  }, [itemId, navigate]);

  /**
   * Le maintien ouvre TOUJOURS la fiche, au seuil — y compris sur une
   * affiche, dont l'appui court l'ouvre déjà au relâchement. On refusait ce
   * doublon (« on n'invente pas un second geste ») ; mais tenir OK est le
   * geste ordinaire d'une télécommande, et une carte qui ne répond qu'au
   * relâchement paraît sourde pendant tout le maintien. Le geste apprend
   * peut-être peu, il RÉPOND — et le verrou armé par l'action longue avale la
   * touche tenue, l'écran d'arrivée ne reçoit rien.
   */
  const press = useMemo(
    () => createLongPress({ short: shortAction, long: longAction }),
    [shortAction, longAction],
  );

  const onFocus = useCallback(() => {
    setFocused(true);
    if (item) aimItem(item);
    onActiveIndex(index);
  }, [index, item, onActiveIndex]);
  const onBlur = useCallback(() => {
    setFocused(false);
    releaseItem();
    press.onBlur();
    onActiveIndex(null);
  }, [press, onActiveIndex]);

  return (
    <div
      ref={root}
      // `role="button"` et non `<button>` : ce dernier synthétise un `click`
      // sur Entrée, et l'action serait jouée deux fois.
      role="button"
      tabIndex={0}
      data-tv-carte
      className="carte-tv relative flex-shrink-0 snap-start"
      style={width ? { width: width } : undefined}
      onKeyDown={press.onKeyDown}
      onKeyUp={press.onKeyUp}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {children}
      {/* Monté au focus seulement, et démonté au blur : une passe de
          composition par carte visitée, jamais quarante en permanence. */}
      {focused && item && (
        <span className="carte-tv-meta">
          <CardMetaOverlay item={item} density="compact" />
        </span>
      )}
    </div>
  );
}
