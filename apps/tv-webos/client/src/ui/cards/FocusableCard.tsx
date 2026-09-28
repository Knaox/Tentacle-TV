import { useCallback, useMemo, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CardOverlayVariant, MediaItem } from "@tentacle-tv/shared";
import { CardMetaOverlay, cardMetaVisible } from "@/components/media/CardMetaOverlay";
import { createLongPress } from "../../focus/longPress";
import { CardActionSheetTv } from "./CardActionSheetTv";
import { releaseItem, aimItem } from "./focusedItem";
import { useSheetFocusReturn } from "./useSheetFocusReturn";

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
 * - **les métadonnées au focus** — 4K, HDR, Dolby Vision, langues ;
 * - **les actions du survol**, à l'appui long (`CardActionSheetTv`).
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
  /** Identifiant de l'item (les appelants le passent ; la carte lit `item`). */
  itemId: string;
  /** L'item complet, pour les pastilles montées au focus et les actions. */
  item?: MediaItem;
  /** La variante du survol que l'appui long déploie (défaut : affiche). */
  variant?: CardOverlayVariant;
  /** « Ne plus me proposer », pour une carte de recommandation. */
  onDismiss?: () => void;
  /** Épinglage du fenêtrage : `null` au blur. */
  onActiveIndex: (index: number | null) => void;
  children: ReactNode;
}

export function FocusableCard({
  index,
  width,
  item,
  variant = "poster",
  onDismiss,
  onActiveIndex,
  children,
}: FocusableCardProps) {
  const root = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  // Sur une affiche, les puces se posent en BAS de l'image, à la place de la
  // note — comme sur tvOS et Android TV : en haut, elles chevauchaient la
  // pastille d'états. La vignette 16:9 garde les siennes en haut à gauche, au
  // coin de sa note ; son bas porte le code et le titre de l'épisode.
  const [metaHost, setMetaHost] = useState<HTMLElement | null>(null);
  const metaShown = useMemo(() => (item ? cardMetaVisible(item, "compact") : false), [item]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  useSheetFocusReturn(root, sheetOpen);

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
   * Le maintien ouvre les ACTIONS de la carte, au seuil — ce que le survol
   * offre sur le web : lire, Ma liste, favori, vu, la note, et la fiche pour
   * une vignette 16:9. Il ouvrait la fiche, que l'appui court ouvre déjà sur
   * une affiche : le geste répondait, mais n'apprenait rien. Le verrou armé
   * par l'action longue avale toujours la touche tenue : la feuille ne reçoit
   * pas le relâchement comme un choix.
   */
  const longAction = useCallback(() => {
    if (item) setSheetOpen(true);
  }, [item]);

  const press = useMemo(
    () => createLongPress({ short: shortAction, long: longAction }),
    [shortAction, longAction],
  );

  const onFocus = useCallback(() => {
    setFocused(true);
    if (variant !== "landscape") {
      setMetaHost(root.current?.querySelector<HTMLElement>("[data-card-visual] > div") ?? null);
    }
    if (item) aimItem(item);
    onActiveIndex(index);
  }, [index, item, variant, onActiveIndex]);
  const onBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      setFocused(false);
      releaseItem();
      press.onBlur();
      // Le focus passe à une carte de la MÊME piste : sa visée repose l'index
      // dans la foulée. Signaler « plus de focus » entre les deux rendait la
      // rangée deux fois par appui et faisait basculer l'atténuation de toutes
      // ses cartes, pour revenir aussitôt à l'état de départ.
      const next = event.relatedTarget;
      const track = root.current?.closest("[data-tv-piste]");
      if (track && next instanceof Node && track.contains(next)) return;
      onActiveIndex(null);
    },
    [press, onActiveIndex],
  );

  return (
    <div
      ref={root}
      // `role="button"` et non `<button>` : ce dernier synthétise un `click`
      // sur Entrée, et l'action serait jouée deux fois.
      role="button"
      tabIndex={0}
      data-tv-carte
      // La note ne cède sa place au focus que si des puces la prennent
      // (`cards-tv.css`) : sans elles, la carte perdait sa note pour rien.
      data-meta={focused && metaShown ? "true" : undefined}
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
      {focused && item && metaShown && (
        metaHost ? (
          createPortal(
            <span className="carte-tv-meta carte-tv-meta-bas">
              <CardMetaOverlay item={item} density="compact" />
            </span>,
            metaHost,
          )
        ) : (
          <span className="carte-tv-meta">
            <CardMetaOverlay item={item} density="compact" />
          </span>
        )
      )}
      {sheetOpen && item && (
        <CardActionSheetTv item={item} variant={variant} onDismiss={onDismiss} onClose={closeSheet} />
      )}
    </div>
  );
}
